function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      `${message || "Expected equality"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

export function assertMatch(value, regex, message) {
  if (!regex.test(String(value))) {
    throw new Error(
      `${message || "Pattern mismatch"}: ${JSON.stringify(value)} did not match ${String(regex)}`
    );
  }
}

export function uniqueEmail(prefix = "aluno") {
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}.${Date.now()}.${rand}@exemplo.com`;
}

export async function readGameStats(h) {
  return h.page.evaluate(() => {
    const readCard = (label) => {
      const ps = Array.from(document.querySelectorAll("p"));
      for (const p of ps) {
        if ((p.innerText || "").trim() === label) {
          const next = p.nextElementSibling;
          if (next) return (next.innerText || "").trim();
        }
      }
      return null;
    };
    return {
      score: Number(readCard("Pontuação") ?? "NaN"),
      correct: Number(readCard("Corretas") ?? "NaN"),
      total: Number(readCard("Total") ?? "NaN"),
      time: readCard("Tempo") || "",
    };
  });
}

export async function readHistorySummary(h) {
  return h.page.evaluate(() => {
    const readCard = (label) => {
      const ps = Array.from(document.querySelectorAll("p"));
      for (const p of ps) {
        if ((p.innerText || "").trim() === label) {
          const next = p.nextElementSibling;
          if (next) return (next.innerText || "").trim();
        }
      }
      return null;
    };
    const sessions = Number(readCard("Sessões") ?? "NaN");
    const totalScore = Number(readCard("Pontuação Total") ?? "NaN");
    const accuracyText = readCard("Acurácia") || "";
    const answers = Number(readCard("Respostas") ?? "NaN");
    return { sessions, totalScore, accuracyText, answers };
  });
}

export async function registerStudent(
  h,
  {
    name,
    email,
    age = "15",
    school = "Escola Demo",
    password = "Password123!",
    passwordConfirm,
    inviteCode,
  }
) {
  await h.goto("/register");
  await h.findHeading(/Criar Conta/i);
  await h.fillField({ id: "name", name: "name", labelRegex: /Nome Completo/i }, name);
  await h.fillField({ id: "email", name: "email", labelRegex: /^Email$/i }, email);
  await h.fillField({ id: "age", name: "age", labelRegex: /Idade/i }, String(age));
  if (school !== undefined) {
    await h.fillField({ id: "school", name: "school", labelRegex: /Escola/i }, school);
  }
  if (inviteCode !== undefined) {
    await h.fillField(
      {
        id: "inviteCode",
        name: "inviteCode",
        labelRegex: /C[óo]digo.*(convite|turma)|Invite/i,
        placeholderRegex: /c[óo]digo|convite|turma/i,
      },
      inviteCode
    );
  }
  await h.fillField({ id: "password", name: "password", labelRegex: /^Senha$/i }, password);
  await h.fillField(
    { id: "passwordConfirm", name: "passwordConfirm", labelRegex: /Confirmar Senha/i },
    passwordConfirm ?? password
  );
  await h.clickButton(/Criar Conta/i);
}

export async function loginWithCreds(
  h,
  email,
  password,
  expectedPathRegex = /^\/(game|admin)$/
) {
  await h.goto("/login");
  await h.findHeading(/Bem-vindo/i);
  await h.fillField({ id: "email", name: "email", labelRegex: /^Email$/i }, email);
  await h.fillField({ id: "password", name: "password", labelRegex: /^Senha$/i }, password);
  await h.clickButton(/Fazer Login/i);
  await h.waitForPath(expectedPathRegex, 10000);
}

export async function demoLogin(h, role = "student") {
  await h.goto("/login");
  await h.findHeading(/Bem-vindo/i);

  if (role === "student") {
    await h.clickButton(/\b(aluno|estudante|student)\b/i);
    await h.waitForPath(/^\/game$/, 10000);
    await h.findHeading(/Jogo de Palavras/i);
  } else if (role === "moderator") {
    await h.clickButton(/\b(professor|moderador|docente|teacher)\b/i);
    await h.waitForPath(/^\/admin$/, 10000);
    await h.findHeading(/Dashboard Administrativo|Painel/i);
  } else if (role === "admin") {
    await h.clickButton(/\b(admin|administrador)\b/i);
    await h.waitForPath(/^\/admin$/, 10000);
    await h.findHeading(/Dashboard Administrativo/i);
  } else {
    throw new Error(`Unknown demo role: ${role}`);
  }
}

export async function waitForQuestionReady(h, minTotal = 0) {
  await h.page.waitForFunction(
    (expectedMinTotal) => {
      const text = document.body?.innerText || "";
      if (!/PALAVRA:/i.test(text) || !/QUEST[ÃA]O:/i.test(text)) return false;
      if (/Verificando\.\.\./i.test(text)) return false;

      const radios = Array.from(document.querySelectorAll('[role="radio"]'));
      if (radios.length !== 4) return false;
      const anyChecked = radios.some(
        (r) => r.getAttribute("aria-checked") === "true" || r.getAttribute("data-state") === "checked"
      );
      if (anyChecked) return false;

      for (let i = 0; i < 4; i++) {
        const lbl = document.querySelector(`label[for="option-${i}"]`);
        const optText = (lbl?.innerText || lbl?.textContent || "").trim();
        if (!optText) return false;
      }

      const ps = Array.from(document.querySelectorAll("p"));
      for (const p of ps) {
        if ((p.innerText || "").trim() === "Total") {
          const val = Number((p.nextElementSibling?.innerText || "").trim());
          if (Number.isNaN(val) || val < expectedMinTotal) return false;
        }
      }
      return true;
    },
    minTotal,
    { timeout: 10000 }
  );
}

export async function startDifficultyGame(h, difficulty = "easy") {
  if ((await h.currentPath()) !== "/game") {
    await h.goto("/game");
  }
  await h.findHeading(/Jogo de Palavras/i);
  await h.clickButton(/Começar Jogo/i);
  await h.findHeading(/Escolha o Nível de Dificuldade/i);

  const rx =
    difficulty === "hard"
      ? /Difícil/i
      : difficulty === "medium"
        ? /Médio/i
        : /Fácil/i;
  await h.clickButton(rx);
  await waitForQuestionReady(h, 0);
}

export async function answerOneQuestion(h, optionIndex = 0) {
  const before = await readGameStats(h);
  await h.clickRadioOption(optionIndex);
  await h.page.waitForFunction(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const submit = btns.find((b) => /Responder/i.test(b.innerText || ""));
    return Boolean(submit && !submit.disabled);
  });
  await h.clickButton(/^Responder$/i);

  await h.page.waitForFunction(
    (expectedTotal) => {
      const ps = Array.from(document.querySelectorAll("p"));
      for (const p of ps) {
        if ((p.innerText || "").trim() === "Total") {
          const val = Number((p.nextElementSibling?.innerText || "").trim());
          return !Number.isNaN(val) && val >= expectedTotal;
        }
      }
      return false;
    },
    before.total + 1,
    { timeout: 10000 }
  );

  const after = await readGameStats(h);
  return {
    before,
    after,
    wasCorrect: after.correct > before.correct,
    pointsEarned: after.score - before.score,
  };
}

export async function endGameSession(h) {
  await h.clickButton(/Finalizar Sessão/i);
  await h.waitForPath(/^\/history$/, 10000);
  await h.findHeading(/Histórico de Jogo/i);
}

export async function getCurrentWord(h) {
  return h.page.evaluate(() => {
    const ps = Array.from(document.querySelectorAll("p"));
    for (const p of ps) {
      if ((p.innerText || "").trim().toUpperCase() === "PALAVRA:") {
        return (p.nextElementSibling?.innerText || "").trim();
      }
    }
    return "";
  });
}

export async function inspectLatestSessionDetails(h, expectedWords = []) {
  await h.waitForText(/Acertos/i, 8000);
  const bodyBefore = await h.page.evaluate(() => (document.body?.innerText || "").trim());

  const clicked = await h.page.evaluate(() => {
    const nodes = Array.from(
      document.querySelectorAll(
        "tr, li:not([data-sonner-toast]):not([data-sonner-toaster] *), div, section, article"
      )
    ).filter((el) => el.id !== "root");

    const matchesSession = (el) => {
      const txt = (el.innerText || "").trim();
      return Boolean(txt && /Acertos/i.test(txt) && /Pontuação/i.test(txt));
    };

    const getDetailBtns = (el) => {
      const btns = Array.from(el.querySelectorAll('button, [role="button"]'));
      const labelOf = (b) =>
        (b.innerText || b.textContent || "").replace(/\s+/g, " ").trim();
      const exact = btns.filter((b) => /Ver Detalhes|Detalhes|Ver/i.test(labelOf(b)));
      if (exact.length > 0) return exact;
      return btns.filter((b) =>
        /detalhes|ver|expandir|respostas/i.test(labelOf(b))
      );
    };

    const sessionNodes = nodes.filter(matchesSession);

    for (const el of sessionNodes) {
      const detailBtns = getDetailBtns(el);
      if (detailBtns.length === 1) {
        const hasNestedOtherBtn = sessionNodes.some(
          (other) =>
            other !== el &&
            el.contains(other) &&
            getDetailBtns(other).some((b) => b !== detailBtns[0])
        );
        if (!hasNestedOtherBtn) {
          detailBtns[0].click();
          return true;
        }
      }
    }

    for (const el of sessionNodes) {
      const detailBtns = getDetailBtns(el);
      if (detailBtns.length === 0) continue;
      const hasMatchingChildWithBtn = sessionNodes.some(
        (other) => other !== el && el.contains(other) && getDetailBtns(other).length > 0
      );
      if (!hasMatchingChildWithBtn) {
        detailBtns[0].click();
        return true;
      }
    }

    for (const el of sessionNodes) {
      const hasMatchingChild = sessionNodes.some(
        (other) => other !== el && el.contains(other)
      );
      if (!hasMatchingChild) {
        el.click();
        return true;
      }
    }

    return false;
  });

  assert(clicked, "Could not locate a session card/row on /history to inspect details");

  await h.waitForText(
    /\b(Correta|Incorreta|Correto|Incorreto)\b|\bPalavra\b|\bResposta\b|Quest[ãa]o\s*\d|✓|✗/i,
    6000
  );

  const words = (Array.isArray(expectedWords) ? expectedWords : [expectedWords]).filter(Boolean);
  if (words.length > 0) {
    await h.page.waitForFunction(
      ({ expectedList, prevLen }) => {
        const txt = (document.body?.innerText || "").trim();
        const lower = txt.toLowerCase();
        const hasWord = expectedList.some((w) => lower.includes(w.toLowerCase()));
        return hasWord && txt.length >= prevLen;
      },
      { expectedList: words, prevLen: bodyBefore.length },
      { timeout: 6000 }
    );
  }
}

export async function createTeacherClass(h, className) {
  await h.fillField(
    {
      id: "className",
      name: "className",
      labelRegex: /Nome.*Turma|Nova Turma|Turma/i,
      placeholderRegex: /turma|nome|7º/i,
    },
    className
  );
  await h.clickButton(/Criar Turma|Nova Turma|Adicionar Turma/i);
  await h.waitForText(new RegExp(className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));

  const inviteCode = await h.page.evaluate((targetName) => {
    const extractFromText = (txt) => {
      const explicit = txt.match(
        /(?:c[óo]digo(?:\s+de\s+convite)?|convite|invite\s*code)\s*[:#-]?\s*([A-Z0-9][A-Z0-9_-]{3,23})/i
      );
      if (explicit) return explicit[1].toUpperCase();
      const codes = txt.match(/\b[A-Z0-9]{5,12}\b/g) || [];
      return codes.find((c) => /[0-9]/.test(c) || c.length >= 6) || null;
    };

    const allNodes = Array.from(
      document.querySelectorAll(
        "tr, li:not([data-sonner-toast]):not([data-sonner-toaster] *), div, section, article"
      )
    );
    let bestCode = null;
    let bestLen = Infinity;
    for (const node of allNodes) {
      if (node.id === "root") continue;
      const txt = (node.innerText || "").trim();
      if (!txt.includes(targetName) || txt.length >= bestLen) continue;
      const codeEl = node.querySelector("[data-invite-code], code");
      const codeTxt = codeEl ? (codeEl.innerText || "").trim() : "";
      const extracted = codeTxt || extractFromText(txt.replace(targetName, ""));
      if (extracted) {
        bestCode = extracted;
        bestLen = txt.length;
      }
    }
    return bestCode;
  }, className);

  assert(inviteCode, `Could not extract inviteCode after creating class "${className}"`);
  return inviteCode;
}

export async function openTeacherClassStudents(h, className) {
  await h.waitForText(new RegExp(className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), 8000);
  const action = await h.page.evaluate((targetName) => {
    const nodes = Array.from(
      document.querySelectorAll(
        "tr, li:not([data-sonner-toast]):not([data-sonner-toaster] *), div, section, article"
      )
    );
    let bestWithBtn = null;
    let bestLen = Infinity;
    let bestAlreadyOpen = false;
    let bestContainer = null;
    let bestContainerLen = Infinity;

    for (const node of nodes) {
      if (node.id === "root") continue;
      const txt = (node.innerText || "").trim();
      if (!txt.includes(targetName)) continue;

      if (txt.length < bestContainerLen) {
        bestContainer = node;
        bestContainerLen = txt.length;
      }

      const btns = Array.from(node.querySelectorAll('button, [role="button"]'));
      const exactBtn = btns.find((b) =>
        /^Ver Alunos$/i.test((b.innerText || b.textContent || "").replace(/\s+/g, " ").trim())
      );
      const fallbackBtn =
        exactBtn ||
        btns.find((b) => {
          const label = (b.innerText || b.textContent || "").replace(/\s+/g, " ").trim();
          return !/Ocultar/i.test(label) && /Ver Alunos|Alunos/i.test(label);
        });
      const openBtn = btns.find((b) =>
        /Ocultar Alunos/i.test((b.innerText || b.textContent || "").replace(/\s+/g, " ").trim())
      );

      if (fallbackBtn && txt.length < bestLen) {
        bestWithBtn = fallbackBtn;
        bestAlreadyOpen = false;
        bestLen = txt.length;
      } else if (openBtn && txt.length < bestLen) {
        bestWithBtn = null;
        bestAlreadyOpen = true;
        bestLen = txt.length;
      }
    }

    if (bestWithBtn) {
      bestWithBtn.click();
      return "clicked";
    }
    if (bestAlreadyOpen) {
      return "already_open";
    }
    if (bestContainer) {
      bestContainer.click();
      return "clicked_container";
    }
    return null;
  }, className);

  assert(action, `Could not locate class "${className}" container to open student roster`);
  await h.waitForText(/Alunos da Turma|Nenhum aluno matriculado/i, 8000);
}

export async function resetDemoFromHome(h) {
  await h.goto("/");
  await h.findHeading(/Aprenda Palavras em Português/i);
  const dlg = await h.acceptNextConfirm(async () => {
    await h.clickButton(/Reset|Reiniciar|Restaurar|Resetar/i);
  });
  if (!dlg.triggered) {
    const clickedModal = await h.page
      .waitForFunction(
        () => {
          const modal = document.querySelector('[role="alertdialog"], [role="dialog"]');
          if (!modal) return false;
          const style = window.getComputedStyle(modal);
          if (style.display === "none" || style.visibility === "hidden") return false;
          const btns = Array.from(modal.querySelectorAll('button, [role="button"]'));
          const confirmBtn = btns.find((b) =>
            /Confirmar|Sim|Reset|Reiniciar|Restaurar|Resetar|Continuar|Ok/i.test(
              (b.innerText || b.textContent || "").trim()
            )
          );
          if (confirmBtn) {
            confirmBtn.click();
            return true;
          }
          return false;
        },
        null,
        { timeout: 600 }
      )
      .catch(() => false);
    if (!clickedModal) {
      await sleep(50);
    }
  }
  await sleep(150);
}
