import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function serializeCall(fn, args) {
  const serializedArgs = args.map((a) => JSON.stringify(a)).join(", ");
  return `(${fn.toString()})(${serializedArgs})`;
}

function formatRemoteArg(arg) {
  if (!arg) return "";
  if (arg.value !== undefined) return String(arg.value);
  if (arg.description) return arg.description;
  return arg.type || "";
}

export async function launchCdpBrowser({
  executablePath,
  headlessFlag = "--headless",
  extraArgs = [],
  launchTimeoutMs = 15000,
} = {}) {
  if (!executablePath) {
    throw new Error("launchCdpBrowser requires executablePath");
  }
  if (typeof globalThis.WebSocket !== "function") {
    throw new Error(
      "Global WebSocket is not available. Node >= 22 is required for cdp-driver.mjs."
    );
  }

  const tempProfileDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "wordgame-e2e-cdp-")
  );

  const launchArgs = [
    headlessFlag,
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-extensions",
    "--window-size=1280,900",
    "--remote-debugging-port=0",
    "--remote-allow-origins=*",
    `--user-data-dir=${tempProfileDir}`,
    ...extraArgs,
    "about:blank",
  ];

  const child = spawn(executablePath, launchArgs, {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  let wsUrl;
  let stderrLog = "";

  try {
    wsUrl = await new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(
            new Error(
              `Timed out waiting for CDP DevTools URL from ${executablePath}.\nStderr:\n${stderrLog}`
            )
          );
        }
      }, launchTimeoutMs);

      const onChunk = (chunk) => {
        const text = chunk.toString("utf8");
        stderrLog += text;
        const match = stderrLog.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (match && !settled) {
          settled = true;
          clearTimeout(timer);
          resolve(match[1]);
        }
      };

      child.stderr.on("data", onChunk);
      child.stdout.on("data", onChunk);
      child.once("error", (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      });
      child.once("exit", (code, signal) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(
            new Error(
              `Browser exited prematurely (code=${code}, signal=${signal}).\nStderr:\n${stderrLog}`
            )
          );
        }
      });
    });
  } catch (err) {
    try {
      child.kill("SIGKILL");
    } catch {
      // ignore
    }
    fs.rmSync(tempProfileDir, { recursive: true, force: true });
    throw err;
  }

  const ws = new globalThis.WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out connecting CDP WebSocket to ${wsUrl}`));
    }, 10000);
    ws.addEventListener(
      "open",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
    ws.addEventListener(
      "error",
      (ev) => {
        clearTimeout(timer);
        reject(new Error(`CDP WebSocket error: ${ev?.message || "connection failed"}`));
      },
      { once: true }
    );
  });

  let nextId = 1;
  const pending = new Map();
  const sessionListeners = new Map();

  ws.addEventListener("message", (event) => {
    let msg;
    try {
      msg = JSON.parse(typeof event.data === "string" ? event.data : String(event.data));
    } catch {
      return;
    }

    if (msg.id !== undefined) {
      const entry = pending.get(msg.id);
      if (entry) {
        pending.delete(msg.id);
        if (msg.error) {
          entry.reject(
            new Error(
              `CDP ${entry.method} failed (${msg.error.code}): ${msg.error.message}`
            )
          );
        } else {
          entry.resolve(msg.result || {});
        }
      }
      return;
    }

    if (msg.method) {
      const key = msg.sessionId || "__browser__";
      const listeners = sessionListeners.get(key);
      if (listeners) {
        for (const fn of [...listeners]) {
          try {
            fn(msg.method, msg.params || {});
          } catch {
            // keep event dispatch resilient
          }
        }
      }
    }
  });

  ws.addEventListener("close", () => {
    for (const [id, entry] of pending.entries()) {
      pending.delete(id);
      entry.reject(new Error(`CDP WebSocket closed before ${entry.method} resolved`));
    }
  });

  function send(method, params = {}, sessionId = undefined) {
    if (ws.readyState !== globalThis.WebSocket.OPEN) {
      return Promise.reject(new Error(`CDP WebSocket is not open (method=${method})`));
    }
    const id = nextId++;
    const payload = sessionId ? { id, method, params, sessionId } : { id, method, params };
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject, method });
      ws.send(JSON.stringify(payload));
    });
  }

  function addSessionListener(sessionId, fn) {
    const key = sessionId || "__browser__";
    if (!sessionListeners.has(key)) {
      sessionListeners.set(key, new Set());
    }
    sessionListeners.get(key).add(fn);
    return () => {
      const set = sessionListeners.get(key);
      if (set) set.delete(fn);
    };
  }

  let closed = false;

  async function newContext() {
    const { browserContextId } = await send("Target.createBrowserContext", {
      disposeOnDetach: true,
    });
    const openPages = new Set();

    async function newPage() {
      const { targetId } = await send("Target.createTarget", {
        url: "about:blank",
        browserContextId,
      });
      const { sessionId } = await send("Target.attachToTarget", {
        targetId,
        flatten: true,
      });

      const errors = {
        consoleErrors: [],
        pageErrors: [],
        networkErrors: [],
      };
      const requestUrls = new Map();
      const onceDialogHandlers = [];
      const onDialogHandlers = [];
      const loadWaiters = new Set();

      const removeListener = addSessionListener(sessionId, (method, params) => {
        if (method === "Runtime.consoleAPICalled") {
          if (params.type === "error") {
            const text = (params.args || []).map(formatRemoteArg).join(" ");
            errors.consoleErrors.push(text || "console.error");
          }
        } else if (method === "Log.entryAdded") {
          if (params.entry?.level === "error") {
            errors.consoleErrors.push(
              `${params.entry.source || "log"}: ${params.entry.text || ""}`
            );
          }
        } else if (method === "Runtime.exceptionThrown") {
          const ex = params.exceptionDetails || {};
          const desc =
            ex.exception?.description ||
            ex.exception?.value ||
            ex.text ||
            "Uncaught page exception";
          errors.pageErrors.push(String(desc));
        } else if (method === "Network.requestWillBeSent") {
          if (params.requestId && params.request?.url) {
            requestUrls.set(params.requestId, params.request.url);
          }
        } else if (method === "Network.responseReceived") {
          const status = params.response?.status;
          const reqUrl = params.response?.url || "";
          if (typeof status === "number" && status >= 400) {
            errors.networkErrors.push({
              url: reqUrl,
              status,
              statusText: params.response?.statusText || "",
              resourceType: params.type || "",
            });
          }
        } else if (method === "Network.loadingFailed") {
          if (!params.canceled) {
            errors.networkErrors.push({
              url: requestUrls.get(params.requestId) || params.requestId,
              status: 0,
              errorText: params.errorText || "Network.loadingFailed",
              resourceType: params.type || "",
            });
          }
        } else if (method === "Page.loadEventFired") {
          for (const resolve of [...loadWaiters]) {
            loadWaiters.delete(resolve);
            resolve();
          }
        } else if (method === "Page.javascriptDialogOpening") {
          let handled = false;
          const handleDialog = async (accept, promptText) => {
            if (handled) return;
            handled = true;
            const dialogParams = { accept: Boolean(accept) };
            if (promptText !== undefined) {
              dialogParams.promptText = String(promptText);
            }
            await send("Page.handleJavaScriptDialog", dialogParams, sessionId).catch(
              () => {}
            );
          };

          const dialog = {
            message: () => params.message || "",
            type: () => params.type || "alert",
            defaultValue: () => params.defaultPrompt || "",
            accept: (promptText) => handleDialog(true, promptText),
            dismiss: () => handleDialog(false),
          };

          const nextOnce = onceDialogHandlers.shift();
          const handlersToRun = nextOnce ? [nextOnce] : [...onDialogHandlers];

          if (handlersToRun.length > 0) {
            Promise.all(handlersToRun.map((h) => Promise.resolve(h(dialog))))
              .then(() => {
                if (!handled) {
                  return dialog.dismiss();
                }
              })
              .catch(() => dialog.dismiss());
          } else {
            // Auto-dismiss safety fallback so window.confirm never deadlocks
            dialog.dismiss();
          }
        }
      });

      await Promise.all([
        send("Page.enable", {}, sessionId),
        send("Runtime.enable", {}, sessionId),
        send("Log.enable", {}, sessionId),
        send("Network.enable", {}, sessionId),
        send("DOM.enable", {}, sessionId),
      ]);

      function waitForNextLoad(timeoutMs = 15000) {
        let cancelFn = () => {};
        const promise = new Promise((resolve, reject) => {
          let settled = false;
          const onLoad = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            loadWaiters.delete(onLoad);
            resolve();
          };
          const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            loadWaiters.delete(onLoad);
            reject(new Error(`Timed out waiting for Page.loadEventFired (${timeoutMs}ms)`));
          }, timeoutMs);
          cancelFn = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            loadWaiters.delete(onLoad);
            resolve();
          };
          loadWaiters.add(onLoad);
        });
        promise.cancel = cancelFn;
        return promise;
      }

      async function evaluate(fn, ...args) {
        const expression =
          typeof fn === "string" ? fn : serializeCall(fn, args);
        const res = await send(
          "Runtime.evaluate",
          {
            expression,
            awaitPromise: true,
            returnByValue: true,
          },
          sessionId
        );
        if (res.exceptionDetails) {
          const ex = res.exceptionDetails;
          const msg =
            ex.exception?.description ||
            ex.exception?.value ||
            ex.text ||
            "Evaluation failed";
          throw new Error(`Page evaluate error: ${msg}`);
        }
        return res.result ? res.result.value : undefined;
      }

      async function settleDom() {
        await evaluate(
          () =>
            new Promise((resolve) => {
              const done = () =>
                requestAnimationFrame(() => setTimeout(resolve, 40));
              if (document.readyState === "complete") {
                done();
              } else {
                window.addEventListener("load", done, { once: true });
              }
            })
        );
      }

      async function goto(targetUrl, { timeout = 15000 } = {}) {
        const loadPromise = waitForNextLoad(timeout);
        try {
          const nav = await send("Page.navigate", { url: targetUrl }, sessionId);
          if (nav.errorText) {
            throw new Error(`Page.navigate to ${targetUrl} failed: ${nav.errorText}`);
          }
          await loadPromise;
        } catch (err) {
          loadPromise.cancel();
          throw err;
        }
        await settleDom();
      }

      async function reload({ timeout = 15000 } = {}) {
        const loadPromise = waitForNextLoad(timeout);
        try {
          await send("Page.reload", { ignoreCache: false }, sessionId);
          await loadPromise;
        } catch (err) {
          loadPromise.cancel();
          throw err;
        }
        await settleDom();
      }

      async function url() {
        return evaluate(() => window.location.href);
      }

      async function title() {
        return evaluate(() => document.title);
      }

      async function content() {
        return evaluate(() => document.documentElement.outerHTML);
      }

      async function waitForFunction(fn, arg = undefined, opts = {}) {
        const timeout = opts?.timeout ?? 10000;
        const polling = opts?.polling ?? 60;
        const deadline = Date.now() + timeout;
        let lastError = null;

        while (Date.now() < deadline) {
          try {
            const val = await evaluate(fn, arg);
            if (val) return val;
            lastError = null;
          } catch (err) {
            lastError = err;
          }
          await sleep(polling);
        }

        if (lastError) {
          throw new Error(
            `waitForFunction timed out after ${timeout}ms (last error: ${lastError.message})`
          );
        }
        throw new Error(`waitForFunction timed out after ${timeout}ms`);
      }

      async function waitForURL(pattern, opts = {}) {
        const timeout = opts?.timeout ?? 10000;
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
          const current = await url();
          let matched = false;
          if (pattern instanceof RegExp) {
            matched = pattern.test(current);
          } else if (typeof pattern === "function") {
            matched = Boolean(pattern(current));
          } else if (typeof pattern === "string") {
            matched = current === pattern || current.includes(pattern);
          }
          if (matched) return current;
          await sleep(50);
        }
        const finalUrl = await url();
        throw new Error(
          `waitForURL(${String(pattern)}) timed out after ${timeout}ms; current URL: ${finalUrl}`
        );
      }

      async function clickSelectorOrFind(finderFn, finderArg, opts = {}) {
        const timeout = opts?.timeout ?? 10000;
        const rect = await waitForFunction(
          ({ fnSrc, arg }) => {
            const fn = eval(`(${fnSrc})`);
            const el = fn(arg);
            if (!el) return null;
            const style = window.getComputedStyle(el);
            if (
              style.visibility === "hidden" ||
              style.display === "none" ||
              el.disabled
            ) {
              return null;
            }
            el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
            const r = el.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0) return null;
            return {
              x: r.left + r.width / 2,
              y: r.top + r.height / 2,
            };
          },
          { fnSrc: finderFn.toString(), arg: finderArg },
          { timeout }
        );

        await send(
          "Input.dispatchMouseEvent",
          { type: "mouseMoved", x: rect.x, y: rect.y },
          sessionId
        );
        await send(
          "Input.dispatchMouseEvent",
          {
            type: "mousePressed",
            x: rect.x,
            y: rect.y,
            button: "left",
            clickCount: 1,
          },
          sessionId
        );
        await send(
          "Input.dispatchMouseEvent",
          {
            type: "mouseReleased",
            x: rect.x,
            y: rect.y,
            button: "left",
            clickCount: 1,
          },
          sessionId
        );
        await sleep(30);
      }

      async function pressKey(key) {
        const keyMap = {
          Backspace: { key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 },
          Enter: { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 },
          Tab: { key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 },
          Escape: { key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 },
        };
        const spec = keyMap[key] || { key, code: key };
        await send(
          "Input.dispatchKeyEvent",
          { type: "rawKeyDown", ...spec },
          sessionId
        );
        await send(
          "Input.dispatchKeyEvent",
          { type: "keyUp", ...spec },
          sessionId
        );
      }

      async function fillInput(finderFn, finderArg, value, opts = {}) {
        const timeout = opts?.timeout ?? 10000;
        const textValue = value === undefined || value === null ? "" : String(value);

        const rect = await waitForFunction(
          ({ fnSrc, arg }) => {
            const fn = eval(`(${fnSrc})`);
            const el = fn(arg);
            if (!el) return null;
            const style = window.getComputedStyle(el);
            if (style.visibility === "hidden" || style.display === "none") {
              return null;
            }
            el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
            const r = el.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0) return null;
            el.focus();
            if (typeof el.select === "function") {
              try {
                el.select();
              } catch {
                // ignore on number inputs in some browsers
              }
            }
            return {
              x: r.left + r.width / 2,
              y: r.top + r.height / 2,
            };
          },
          { fnSrc: finderFn.toString(), arg: finderArg },
          { timeout }
        );

        await send(
          "Input.dispatchMouseEvent",
          { type: "mousePressed", x: rect.x, y: rect.y, button: "left", clickCount: 1 },
          sessionId
        );
        await send(
          "Input.dispatchMouseEvent",
          { type: "mouseReleased", x: rect.x, y: rect.y, button: "left", clickCount: 1 },
          sessionId
        );

        // Select all (Ctrl+A) and Backspace
        await send(
          "Input.dispatchKeyEvent",
          {
            type: "rawKeyDown",
            key: "a",
            code: "KeyA",
            windowsVirtualKeyCode: 65,
            modifiers: 2,
          },
          sessionId
        );
        await send(
          "Input.dispatchKeyEvent",
          {
            type: "keyUp",
            key: "a",
            code: "KeyA",
            windowsVirtualKeyCode: 65,
            modifiers: 2,
          },
          sessionId
        );
        await pressKey("Backspace");

        if (textValue.length > 0) {
          await send("Input.insertText", { text: textValue }, sessionId);
        }

        // Verify controlled React state received exact value; fallback to native setter if needed
        await evaluate(
          ({ fnSrc, arg, expected }) => {
            const fn = eval(`(${fnSrc})`);
            const el = fn(arg);
            if (!el) return;
            if (el.value !== expected) {
              const proto =
                el.tagName === "TEXTAREA"
                  ? window.HTMLTextAreaElement.prototype
                  : el.tagName === "SELECT"
                    ? window.HTMLSelectElement.prototype
                    : window.HTMLInputElement.prototype;
              const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
              if (setter) {
                setter.call(el, expected);
              } else {
                el.value = expected;
              }
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
            }
          },
          { fnSrc: finderFn.toString(), arg: finderArg, expected: textValue }
        );
      }

      function on(eventName, handler) {
        if (eventName === "dialog") {
          onDialogHandlers.push(handler);
        }
      }

      function once(eventName, handler) {
        if (eventName === "dialog") {
          onceDialogHandlers.push(handler);
        }
      }

      function off(eventName, handler) {
        if (eventName === "dialog") {
          const idx = onDialogHandlers.indexOf(handler);
          if (idx >= 0) onDialogHandlers.splice(idx, 1);
          const idxOnce = onceDialogHandlers.indexOf(handler);
          if (idxOnce >= 0) onceDialogHandlers.splice(idxOnce, 1);
        }
      }

      let pageClosed = false;
      async function close() {
        if (pageClosed) return;
        pageClosed = true;
        openPages.delete(page);
        removeListener();
        await send("Target.closeTarget", { targetId }).catch(() => {});
      }

      const page = {
        errors,
        goto,
        reload,
        url,
        title,
        content,
        evaluate,
        waitForFunction,
        waitForURL,
        clickSelectorOrFind,
        fillInput,
        pressKey,
        on,
        once,
        off,
        close,
      };

      openPages.add(page);
      return page;
    }

    let contextClosed = false;
    async function close() {
      if (contextClosed) return;
      contextClosed = true;
      for (const p of [...openPages]) {
        await p.close().catch(() => {});
      }
      await send("Target.disposeBrowserContext", { browserContextId }).catch(
        () => {}
      );
    }

    return {
      newPage,
      close,
    };
  }

  async function close() {
    if (closed) return;
    closed = true;
    let closeTimer;
    try {
      if (ws.readyState === globalThis.WebSocket.OPEN) {
        await Promise.race([
          send("Browser.close").catch(() => {}),
          new Promise((resolve) => {
            closeTimer = setTimeout(resolve, 1500);
            closeTimer.unref?.();
          }),
        ]);
      }
    } finally {
      if (closeTimer) clearTimeout(closeTimer);
      try {
        ws.close();
      } catch {
        // ignore
      }
      if (child.pid) {
        if (process.platform === "win32") {
          try {
            execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
              stdio: "ignore",
            });
          } catch {
            try {
              child.kill("SIGKILL");
            } catch {
              try {
                child.kill();
              } catch {
                // ignore
              }
            }
          }
        } else {
          try {
            child.kill("SIGKILL");
          } catch {
            try {
              child.kill();
            } catch {
              // ignore
            }
          }
        }
      }
      try {
        child.stdin?.destroy();
      } catch {
        // ignore
      }
      try {
        child.stdout?.destroy();
      } catch {
        // ignore
      }
      try {
        child.stderr?.destroy();
      } catch {
        // ignore
      }
      try {
        child.unref();
      } catch {
        // ignore
      }
      await sleep(100);
      try {
        fs.rmSync(tempProfileDir, { recursive: true, force: true });
      } catch {
        // retry once after short wait on Windows file locks
        await sleep(250);
        try {
          fs.rmSync(tempProfileDir, { recursive: true, force: true });
        } catch {
          // ignore
        }
      }
    }
  }

  return {
    newContext,
    close,
    executablePath,
  };
}
