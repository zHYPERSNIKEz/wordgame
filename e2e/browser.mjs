import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { launchCdpBrowser } from "./cdp-driver.mjs";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function serializeRegex(pattern) {
  if (!pattern) return null;
  if (pattern instanceof RegExp) {
    return { source: pattern.source, flags: pattern.flags };
  }
  const escaped = String(pattern).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return { source: escaped, flags: "i" };
}

function findPlaywrightDirMatches(baseDir, prefix, relativeExeParts) {
  if (!baseDir || !fs.existsSync(baseDir)) return [];
  let entries;
  try {
    entries = fs.readdirSync(baseDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const matches = entries
    .filter((d) => d.isDirectory() && d.name.startsWith(prefix))
    .map((d) => d.name)
    .sort()
    .reverse();

  const results = [];
  for (const dirName of matches) {
    const candidate = path.join(baseDir, dirName, ...relativeExeParts);
    if (fs.existsSync(candidate)) {
      results.push(candidate);
    }
  }
  return results;
}

export function findBrowserExecutable() {
  const envPath =
    process.env.E2E_BROWSER_PATH ||
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (envPath && fs.existsSync(envPath)) {
    const isShell = path.basename(envPath).toLowerCase().includes("headless-shell");
    return {
      executablePath: envPath,
      headlessFlag: isShell ? "--headless" : "--headless=new",
    };
  }

  const localAppData =
    process.env.LOCALAPPDATA ||
    (process.env.USERPROFILE
      ? path.join(process.env.USERPROFILE, "AppData", "Local")
      : "");
  const msPlaywrightDir = localAppData
    ? path.join(localAppData, "ms-playwright")
    : "";

  if (process.platform === "win32") {
    const headlessShells = findPlaywrightDirMatches(
      msPlaywrightDir,
      "chromium_headless_shell-",
      ["chrome-headless-shell-win64", "chrome-headless-shell.exe"]
    );
    if (headlessShells.length > 0) {
      return { executablePath: headlessShells[0], headlessFlag: "--headless" };
    }

    const fullChromiums = findPlaywrightDirMatches(
      msPlaywrightDir,
      "chromium-",
      ["chrome-win64", "chrome.exe"]
    );
    if (fullChromiums.length > 0) {
      return { executablePath: fullChromiums[0], headlessFlag: "--headless=new" };
    }

    const systemCandidates = [
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      localAppData
        ? path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe")
        : "",
    ].filter(Boolean);

    for (const candidate of systemCandidates) {
      if (fs.existsSync(candidate)) {
        return { executablePath: candidate, headlessFlag: "--headless=new" };
      }
    }
  } else {
    const home = process.env.HOME || "";
    const linuxPlaywright = home ? path.join(home, ".cache", "ms-playwright") : "";
    const shells = findPlaywrightDirMatches(
      linuxPlaywright,
      "chromium_headless_shell-",
      ["chrome-linux", "headless_shell"]
    );
    if (shells.length > 0) {
      return { executablePath: shells[0], headlessFlag: "--headless" };
    }

    const unixCandidates = [
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/google-chrome",
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ];
    for (const candidate of unixCandidates) {
      if (fs.existsSync(candidate)) {
        return { executablePath: candidate, headlessFlag: "--headless=new" };
      }
    }
  }

  throw new Error(
    "No Chromium/Edge/Chrome executable found. Set E2E_BROWSER_PATH or install Playwright Chromium."
  );
}

async function tryImportPlaywright() {
  for (const pkgName of ["playwright", "playwright-core"]) {
    try {
      const mod = await import(pkgName);
      if (mod?.chromium) return { pkgName, chromium: mod.chromium };
    } catch {
      // not locally installed
    }
  }

  try {
    const globalRoot = execFileSync("npm", ["root", "-g"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (globalRoot) {
      for (const pkgName of ["playwright", "playwright-core"]) {
        const entry = path.join(globalRoot, pkgName, "index.mjs");
        const entryJs = path.join(globalRoot, pkgName, "index.js");
        const target = fs.existsSync(entry)
          ? entry
          : fs.existsSync(entryJs)
            ? entryJs
            : null;
        if (target) {
          const mod = await import(pathToFileURL(target).href);
          if (mod?.chromium) return { pkgName: `${pkgName} (global)`, chromium: mod.chromium };
        }
      }
    }
  } catch {
    // ignore global lookup failures
  }

  return null;
}

function wrapPlaywrightPage(pwPage) {
  const errors = {
    consoleErrors: [],
    pageErrors: [],
    networkErrors: [],
  };

  pwPage.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.consoleErrors.push(msg.text());
    }
  });
  pwPage.on("pageerror", (err) => {
    errors.pageErrors.push(err?.message || String(err));
  });
  pwPage.on("response", (res) => {
    if (res.status() >= 400) {
      errors.networkErrors.push({
        url: res.url(),
        status: res.status(),
        statusText: res.statusText(),
      });
    }
  });
  pwPage.on("requestfailed", (req) => {
    const errText = req.failure()?.errorText || "requestfailed";
    if (!errText.includes("ERR_ABORTED")) {
      errors.networkErrors.push({
        url: req.url(),
        status: 0,
        errorText: errText,
      });
    }
  });

  // Safety auto-dismiss if no explicit dialog handler registered
  pwPage.on("dialog", async (dialog) => {
    if (pwPage.listenerCount("dialog") <= 1) {
      await dialog.dismiss().catch(() => {});
    }
  });

  return {
    errors,
    goto: (url, opts) => pwPage.goto(url, { waitUntil: "load", ...opts }),
    reload: (opts) => pwPage.reload({ waitUntil: "load", ...opts }),
    url: async () => pwPage.url(),
    title: () => pwPage.title(),
    content: () => pwPage.content(),
    evaluate: (fn, ...args) => pwPage.evaluate(fn, ...args),
    waitForFunction: async (fn, arg, opts) => {
      const handle = await pwPage.waitForFunction(fn, arg, opts);
      return handle ? handle.jsonValue() : undefined;
    },
    waitForURL: (pattern, opts) => pwPage.waitForURL(pattern, opts),
    clickSelectorOrFind: async (finderFn, finderArg, opts = {}) => {
      const timeout = opts?.timeout ?? 10000;
      const handle = await pwPage.waitForFunction(
        ({ fnSrc, arg }) => {
          const fn = eval(`(${fnSrc})`);
          const el = fn(arg);
          if (!el) return null;
          const style = window.getComputedStyle(el);
          if (style.visibility === "hidden" || style.display === "none" || el.disabled) {
            return null;
          }
          el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) return null;
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        },
        { fnSrc: finderFn.toString(), arg: finderArg },
        { timeout }
      );
      const rect = await handle.jsonValue();
      await pwPage.mouse.click(rect.x, rect.y);
      await sleep(30);
    },
    fillInput: async (finderFn, finderArg, value, opts = {}) => {
      const timeout = opts?.timeout ?? 10000;
      const textValue = value === undefined || value === null ? "" : String(value);
      const handle = await pwPage.waitForFunction(
        ({ fnSrc, arg }) => {
          const fn = eval(`(${fnSrc})`);
          const el = fn(arg);
          if (!el) return null;
          const style = window.getComputedStyle(el);
          if (style.visibility === "hidden" || style.display === "none") return null;
          el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) return null;
          el.focus();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        },
        { fnSrc: finderFn.toString(), arg: finderArg },
        { timeout }
      );
      const rect = await handle.jsonValue();
      await pwPage.mouse.click(rect.x, rect.y);
      await pwPage.keyboard.press("Control+A");
      await pwPage.keyboard.press("Backspace");
      if (textValue.length > 0) {
        await pwPage.keyboard.insertText(textValue);
      }
      await pwPage.evaluate(
        ({ fnSrc, arg, expected }) => {
          const fn = eval(`(${fnSrc})`);
          const el = fn(arg);
          if (el && el.value !== expected) {
            const proto =
              el.tagName === "TEXTAREA"
                ? window.HTMLTextAreaElement.prototype
                : window.HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
            if (setter) setter.call(el, expected);
            else el.value = expected;
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }
        },
        { fnSrc: finderFn.toString(), arg: finderArg, expected: textValue }
      );
    },
    pressKey: (key) => pwPage.keyboard.press(key),
    on: (ev, handler) => pwPage.on(ev, handler),
    once: (ev, handler) => pwPage.once(ev, handler),
    off: (ev, handler) => pwPage.off(ev, handler),
    close: () => pwPage.close(),
  };
}

export async function launchBrowser() {
  const pw = await tryImportPlaywright();
  if (pw) {
    let launchOpts = { headless: true };
    try {
      const discovered = findBrowserExecutable();
      if (!discovered.executablePath.includes("headless-shell")) {
        launchOpts.executablePath = discovered.executablePath;
      }
    } catch {
      // let playwright use its own default binary
    }
    const browser = await pw.chromium.launch(launchOpts);
    return {
      driverName: pw.pkgName,
      browser,
      newContext: async () => {
        const ctx = await browser.newContext();
        return {
          newPage: async () => wrapPlaywrightPage(await ctx.newPage()),
          close: () => ctx.close(),
        };
      },
      close: () => browser.close(),
    };
  }

  const { executablePath, headlessFlag } = findBrowserExecutable();
  const cdpBrowser = await launchCdpBrowser({ executablePath, headlessFlag });
  return {
    driverName: `cdp-driver (${path.basename(executablePath)})`,
    browser: cdpBrowser,
    newContext: () => cdpBrowser.newContext(),
    close: () => cdpBrowser.close(),
  };
}

// Browser-side DOM finder functions (serialized via .toString())
function domFindButton(rxSpec) {
  const rx = new RegExp(rxSpec.source, rxSpec.flags);
  const candidates = Array.from(
    document.querySelectorAll('button, [role="button"]')
  );
  for (const el of candidates) {
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    const label = (
      el.innerText ||
      el.textContent ||
      el.getAttribute("aria-label") ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim();
    if (rx.test(label)) return el;
  }
  return null;
}

function domFindLinkOrButton(rxSpec) {
  const rx = new RegExp(rxSpec.source, rxSpec.flags);
  const candidates = Array.from(
    document.querySelectorAll('button, a, [role="button"], [role="link"]')
  );
  for (const el of candidates) {
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    const label = (
      el.innerText ||
      el.textContent ||
      el.getAttribute("aria-label") ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim();
    if (rx.test(label)) return el;
  }
  return null;
}

function domFindInput(spec) {
  const isVisible = (el) => {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  if (spec.id) {
    const byId = document.getElementById(spec.id);
    if (isVisible(byId)) return byId;
  }
  if (spec.name) {
    const byName = document.querySelector(`[name="${spec.name}"]`);
    if (isVisible(byName)) return byName;
  }
  if (spec.labelRx) {
    const rx = new RegExp(spec.labelRx.source, spec.labelRx.flags);
    const labels = Array.from(document.querySelectorAll("label"));
    for (const lbl of labels) {
      const txt = (lbl.innerText || lbl.textContent || "").replace(/\s+/g, " ").trim();
      if (!rx.test(txt)) continue;
      if (lbl.htmlFor) {
        const target = document.getElementById(lbl.htmlFor);
        if (isVisible(target)) return target;
      }
      const nested = lbl.querySelector("input, textarea, select");
      if (isVisible(nested)) return nested;
    }
  }
  const allInputs = Array.from(
    document.querySelectorAll("input, textarea, select")
  );
  for (const input of allInputs) {
    if (!isVisible(input)) continue;
    const ph = input.getAttribute("placeholder") || "";
    const aria = input.getAttribute("aria-label") || "";
    if (spec.placeholderRx) {
      const prx = new RegExp(spec.placeholderRx.source, spec.placeholderRx.flags);
      if (prx.test(ph)) return input;
    }
    if (spec.labelRx) {
      const lrx = new RegExp(spec.labelRx.source, spec.labelRx.flags);
      if (lrx.test(aria) || lrx.test(ph)) return input;
    }
  }
  return null;
}

function domFindRadio(index) {
  const radios = Array.from(document.querySelectorAll('[role="radio"]'));
  if (radios[index]) return radios[index];
  return document.getElementById(`option-${index}`);
}

export function createHelpers(page, baseUrl) {
  async function goto(routePath = "/") {
    const target = routePath.startsWith("http")
      ? routePath
      : `${baseUrl}${routePath.startsWith("/") ? "" : "/"}${routePath}`;
    await page.goto(target);
  }

  async function reload() {
    await page.reload();
  }

  async function currentPath() {
    const currentUrl = await page.url();
    return new URL(currentUrl).pathname;
  }

  async function waitForPath(pattern, timeout = 10000) {
    const rxSpec =
      pattern instanceof RegExp
        ? serializeRegex(pattern)
        : serializeRegex(new RegExp(`^${String(pattern).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
    return page.waitForFunction(
      (spec) => {
        const rx = new RegExp(spec.source, spec.flags);
        return rx.test(window.location.pathname) ? window.location.pathname : null;
      },
      rxSpec,
      { timeout }
    );
  }

  async function findButton(regex, opts = {}) {
    const timeout = opts?.timeout ?? 10000;
    const rxSpec = serializeRegex(regex);
    const found = await page.waitForFunction(
      ({ fnSrc, spec }) => {
        const fn = eval(`(${fnSrc})`);
        const el = fn(spec);
        if (!el) return null;
        return (el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim();
      },
      { fnSrc: domFindButton.toString(), spec: rxSpec },
      { timeout }
    );
    return found;
  }

  async function clickButton(regex, opts = {}) {
    const rxSpec = serializeRegex(regex);
    await page.clickSelectorOrFind(domFindButton, rxSpec, opts);
  }

  async function clickLinkOrButton(regex, opts = {}) {
    const rxSpec = serializeRegex(regex);
    await page.clickSelectorOrFind(domFindLinkOrButton, rxSpec, opts);
  }

  async function findHeading(regex, opts = {}) {
    const timeout = opts?.timeout ?? 10000;
    const rxSpec = serializeRegex(regex);
    return page.waitForFunction(
      (spec) => {
        const rx = new RegExp(spec.source, spec.flags);
        const headings = Array.from(
          document.querySelectorAll('h1, h2, h3, h4, [role="heading"]')
        );
        for (const h of headings) {
          const style = window.getComputedStyle(h);
          if (style.display === "none" || style.visibility === "hidden") continue;
          const r = h.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) continue;
          const text = (h.innerText || h.textContent || "").replace(/\s+/g, " ").trim();
          if (rx.test(text)) return text;
        }
        return null;
      },
      rxSpec,
      { timeout }
    );
  }

  function buildInputSpec(opts) {
    return {
      id: opts?.id || null,
      name: opts?.name || null,
      labelRx: opts?.labelRegex ? serializeRegex(opts.labelRegex) : null,
      placeholderRx: opts?.placeholderRegex
        ? serializeRegex(opts.placeholderRegex)
        : null,
    };
  }

  async function findInputByLabelOrAttr(opts, waitOpts = {}) {
    const timeout = waitOpts?.timeout ?? 10000;
    const spec = buildInputSpec(opts);
    return page.waitForFunction(
      ({ fnSrc, arg }) => {
        const fn = eval(`(${fnSrc})`);
        const el = fn(arg);
        if (!el) return null;
        return {
          id: el.id || "",
          name: el.name || "",
          type: el.type || "",
          value: el.value || "",
        };
      },
      { fnSrc: domFindInput.toString(), arg: spec },
      { timeout }
    );
  }

  async function fillField(opts, value, waitOpts = {}) {
    const spec = buildInputSpec(opts);
    await page.fillInput(domFindInput, spec, value, waitOpts);
  }

  async function getFieldAttr(opts, attrName) {
    const spec = buildInputSpec(opts);
    return page.evaluate(
      ({ fnSrc, arg, attr }) => {
        const fn = eval(`(${fnSrc})`);
        const el = fn(arg);
        if (!el) return null;
        if (attr in el && typeof el[attr] !== "function") {
          return el[attr];
        }
        return el.getAttribute(attr);
      },
      { fnSrc: domFindInput.toString(), arg: spec, attr: attrName }
    );
  }

  async function isButtonDisabled(regex) {
    const rxSpec = serializeRegex(regex);
    return page.evaluate(
      ({ fnSrc, spec }) => {
        const fn = eval(`(${fnSrc})`);
        const el = fn(spec);
        if (!el) return null;
        return Boolean(el.disabled || el.getAttribute("aria-disabled") === "true");
      },
      { fnSrc: domFindButton.toString(), spec: rxSpec }
    );
  }

  async function clickRadioOption(index = 0, opts = {}) {
    const timeout = opts?.timeout ?? 10000;
    await page.waitForFunction(
      (idx) => {
        const radios = Array.from(document.querySelectorAll('[role="radio"]'));
        return radios.length > idx || Boolean(document.getElementById(`option-${idx}`));
      },
      index,
      { timeout }
    );
    await page.clickSelectorOrFind(domFindRadio, index, { timeout });
  }

  async function getRadioCount() {
    return page.evaluate(() => document.querySelectorAll('[role="radio"]').length);
  }

  async function getRadioLabels() {
    return page.evaluate(() => {
      const radios = Array.from(document.querySelectorAll('[role="radio"]'));
      return radios.map((r, i) => {
        const id = r.id || `option-${i}`;
        const lbl = document.querySelector(`label[for="${id}"]`);
        return (lbl?.innerText || lbl?.textContent || r.parentElement?.innerText || "").trim();
      });
    });
  }

  async function waitForText(regex, timeout = 10000) {
    const rxSpec = serializeRegex(regex);
    return page.waitForFunction(
      (spec) => {
        const rx = new RegExp(spec.source, spec.flags);
        const text = document.body?.innerText || "";
        const match = text.match(rx);
        return match ? match[0] : null;
      },
      rxSpec,
      { timeout }
    );
  }

  async function waitForToast(regex, timeout = 10000) {
    const rxSpec = serializeRegex(regex);
    return page.waitForFunction(
      (spec) => {
        const rx = new RegExp(spec.source, spec.flags);
        const toasts = Array.from(
          document.querySelectorAll(
            '[data-sonner-toast], [data-sonner-toaster] li, [role="status"]'
          )
        );
        for (const el of toasts) {
          const style = window.getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden") continue;
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) continue;
          const txt = (el.innerText || el.textContent || "")
            .replace(/\s+/g, " ")
            .trim();
          if (txt && rx.test(txt)) return txt;
        }
        return null;
      },
      rxSpec,
      { timeout }
    );
  }

  async function hasText(regex) {
    const rxSpec = serializeRegex(regex);
    return page.evaluate((spec) => {
      const rx = new RegExp(spec.source, spec.flags);
      return rx.test(document.body?.innerText || "");
    }, rxSpec);
  }

  async function expectNoText(regex) {
    const present = await hasText(regex);
    if (present) {
      throw new Error(`Expected page NOT to contain text matching ${String(regex)}`);
    }
  }

  async function hasVisibleElement(selector) {
    return page.evaluate((sel) => {
      const els = Array.from(document.querySelectorAll(sel));
      return els.some((el) => {
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
    }, selector);
  }

  async function hasButton(regex) {
    const rxSpec = serializeRegex(regex);
    return page.evaluate(
      ({ fnSrc, spec }) => {
        const fn = eval(`(${fnSrc})`);
        return Boolean(fn(spec));
      },
      { fnSrc: domFindButton.toString(), spec: rxSpec }
    );
  }

  async function acceptNextConfirm(fn) {
    let dialogInfo = { triggered: false, message: "" };
    let pendingHandle = null;
    const handler = (dialog) => {
      dialogInfo = { triggered: true, message: dialog.message() };
      pendingHandle = Promise.resolve(dialog.accept());
      return pendingHandle;
    };
    page.once("dialog", handler);
    try {
      await fn();
      if (!dialogInfo.triggered) {
        await sleep(50);
      }
      if (pendingHandle) {
        await pendingHandle;
      }
    } finally {
      page.off("dialog", handler);
    }
    return dialogInfo;
  }

  async function dismissNextConfirm(fn) {
    let dialogInfo = { triggered: false, message: "" };
    let pendingHandle = null;
    const handler = (dialog) => {
      dialogInfo = { triggered: true, message: dialog.message() };
      pendingHandle = Promise.resolve(dialog.dismiss());
      return pendingHandle;
    };
    page.once("dialog", handler);
    try {
      await fn();
      if (!dialogInfo.triggered) {
        await sleep(50);
      }
      if (pendingHandle) {
        await pendingHandle;
      }
    } finally {
      page.off("dialog", handler);
    }
    return dialogInfo;
  }

  async function allowExpectedMutationErrors(fn) {
    const startIdx = page.errors.consoleErrors.length;
    try {
      return await fn();
    } finally {
      const added = page.errors.consoleErrors.slice(startIdx);
      const kept = added.filter((msg) => !/^\[API Mutation Error\]/.test(msg));
      page.errors.consoleErrors.splice(startIdx, added.length, ...kept);
    }
  }

  async function getLocalStorage(key) {
    return page.evaluate((k) => window.localStorage.getItem(k), key);
  }

  async function clearLocalStorage() {
    await page.evaluate(() => window.localStorage.clear());
  }

  function assertZeroErrors() {
    const { consoleErrors, pageErrors, networkErrors } = page.errors;
    const problems = [];
    if (consoleErrors.length > 0) {
      problems.push(`consoleErrors(${consoleErrors.length}): ${consoleErrors.join(" | ")}`);
    }
    if (pageErrors.length > 0) {
      problems.push(`pageErrors(${pageErrors.length}): ${pageErrors.join(" | ")}`);
    }
    if (networkErrors.length > 0) {
      problems.push(
        `networkErrors(${networkErrors.length}): ${networkErrors
          .map((e) => `${e.status} ${e.url} ${e.errorText || ""}`.trim())
          .join(" | ")}`
      );
    }
    if (problems.length > 0) {
      throw new Error(`Zero-error gate failed -> ${problems.join(" ; ")}`);
    }
  }

  return {
    page,
    baseUrl,
    goto,
    reload,
    currentPath,
    waitForPath,
    findButton,
    clickButton,
    clickLinkOrButton,
    hasButton,
    findHeading,
    findInputByLabelOrAttr,
    fillField,
    getFieldAttr,
    isButtonDisabled,
    clickRadioOption,
    getRadioCount,
    getRadioLabels,
    waitForText,
    waitForToast,
    hasText,
    expectNoText,
    hasVisibleElement,
    acceptNextConfirm,
    dismissNextConfirm,
    allowExpectedMutationErrors,
    getLocalStorage,
    clearLocalStorage,
    assertZeroErrors,
  };
}
