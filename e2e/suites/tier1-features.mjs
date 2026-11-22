import http from "node:http";
import https from "node:https";
import {
  answerOneQuestion,
  assert,
  assertEqual,
  createTeacherClass,
  demoLogin,
  endGameSession,
  getCurrentWord,
  inspectLatestSessionDetails,
  loginWithCreds,
  openTeacherClassStudents,
  readGameStats,
  readHistorySummary,
  registerStudent,
  resetDemoFromHome,
  startDifficultyGame,
  uniqueEmail,
  waitForQuestionReady,
} from "./common.mjs";

function rawHttpGetStatus(baseUrl, rawPath) {
  const parsed = new URL(baseUrl);
  const client = parsed.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: rawPath,
        method: "GET",
      },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      }
    );
    req.on("error", reject);
    req.end();
  });
}

export const tier1Tests = [
  {
    id: "T1-A1-1",
    area: "A1",
    name: "Load / unauthenticated shows brand, heading, Login/Cadastro, and demo indicator",
    async run(h) {
      await h.goto("/");
      await h.findHeading(/Aprenda Palavras em Português/i);
      assert(await h.hasText(/WordGame/i), "WordGame brand should be visible");
      await h.findButton(/^Login$/i);
      await h.findButton(/^Cadastro$/i);
      assert(
        await h.hasText(/demo|demonstra[çc][ãa]o|portf[óo]lio/i),
        "Demo mode badge or indicator should be visible on /"
      );
    },
  },
  {
    id: "T1-A1-2",
    area: "A1",
    name: "Click Login and Cadastro from / nav navigates to /login and /register",
    async run(h) {
      await h.goto("/");
      await h.clickButton(/^Login$/i);
      await h.waitForPath(/^\/login$/);
      await h.findHeading(/Bem-vindo/i);

      await h.goto("/");
      await h.clickButton(/^Cadastro$/i);
      await h.waitForPath(/^\/register$/);
      await h.findHeading(/Criar Conta/i);
    },
  },
  {
    id: "T1-A1-3",
    area: "A1",
    name: "Click Começar Agora and Criar Conta Gratuitamente on / navigates to /register",
    async run(h) {
      await h.goto("/");
      await h.clickButton(/Começar Agora/i);
      await h.waitForPath(/^\/register$/);
      await h.findHeading(/Criar Conta/i);

      await h.goto("/");
      await h.clickButton(/Criar Conta Gratuitamente/i);
      await h.waitForPath(/^\/register$/);
      await h.findHeading(/Criar Conta/i);
    },
  },
  {
    id: "T1-A1-4",
    area: "A1",
    name: "Load / authenticated as Student vs Admin/Professor shows role-appropriate nav",
    async run(h) {
      await demoLogin(h, "student");
      await h.goto("/");
      await h.findHeading(/Aprenda Palavras em Português/i);
      await h.findButton(/^Jogar$/i);
      assert(!(await h.hasButton(/^Login$/i)), "Login button hidden when authenticated");
      assert(!(await h.hasButton(/^Cadastro$/i)), "Cadastro button hidden when authenticated");
      assert(!(await h.hasButton(/Dashboard/i)), "Dashboard hidden for student");

      await h.clearLocalStorage();
      await demoLogin(h, "admin");
      await h.goto("/");
      await h.findButton(/^Jogar$/i);
      await h.findButton(/Dashboard/i);
    },
  },
  {
    id: "T1-A1-5",
    area: "A1",
    name: "Trigger Reset Demo on / restores initial seeded localStorage state",
    async run(h) {
      const email = uniqueEmail("reset");
      await registerStudent(h, {
        name: "Usuário Temporário",
        email,
        age: "16",
        password: "Password123!",
      });
      await h.waitForPath(/^\/login$/);

      await resetDemoFromHome(h);

      // Attempt login with custom user after reset must fail
      await h.goto("/login");
      await h.fillField({ id: "email", name: "email", labelRegex: /^Email$/i }, email);
      await h.fillField({ id: "password", name: "password", labelRegex: /^Senha$/i }, "Password123!");
      await h.allowExpectedMutationErrors(async () => {
        await h.clickButton(/Fazer Login/i);
        await h.waitForText(/inv[áa]lid|erro|incorret|n[ãa]o encontrad/i, 6000);
      });
      assertEqual(await h.currentPath(), "/login", "Custom user removed after Reset Demo");
    },
  },
  {
    id: "T1-A2-1",
    area: "A2",
    name: "Register new student with valid fields shows success toast and redirects to /login",
    async run(h) {
      const email = uniqueEmail("t1a21");
      await registerStudent(h, {
        name: "Lucas Silva",
        email,
        age: "14",
        school: "Colégio Brasil",
        password: "Password123!",
      });
      await h.waitForText(/Conta criada com sucesso/i, 8000);
      await h.waitForPath(/^\/login$/, 8000);
    },
  },
  {
    id: "T1-A2-2",
    area: "A2",
    name: "Login with newly registered student credentials redirects to /game with greeting",
    async run(h) {
      const email = uniqueEmail("t1a22");
      await registerStudent(h, {
        name: "Marina Costa",
        email,
        age: "16",
        school: "Escola Estadual Norte",
        password: "Password123!",
      });
      await h.waitForPath(/^\/login$/);
      await loginWithCreds(h, email, "Password123!", /^\/game$/);
      await h.waitForText(/Login realizado com sucesso/i, 6000);
      await h.waitForText(/Bem-vindo,\s*Marina Costa/i, 6000);
    },
  },
  {
    id: "T1-A2-3",
    area: "A2",
    name: "1-click Demo Login as Aluno logs in and navigates to /game",
    async run(h) {
      await demoLogin(h, "student");
      assertEqual(await h.currentPath(), "/game", "Should navigate to /game");
      await h.waitForText(/Bem-vindo,/i);
    },
  },
  {
    id: "T1-A2-4",
    area: "A2",
    name: "1-click Demo Login as Professor and Admin navigate to /admin",
    async run(h) {
      await demoLogin(h, "moderator");
      assertEqual(await h.currentPath(), "/admin", "Professor navigates to /admin");
      await h.clickButton(/^Sair$/i);
      await h.waitForPath(/^\/login$/);

      await demoLogin(h, "admin");
      assertEqual(await h.currentPath(), "/admin", "Admin navigates to /admin");
    },
  },
  {
    id: "T1-A2-5",
    area: "A2",
    name: "Toggle password visibility on /login and logout from /game",
    async run(h) {
      await h.goto("/login");
      await h.findHeading(/Bem-vindo/i);
      await h.fillField({ id: "password", name: "password", labelRegex: /^Senha$/i }, "Secret123");
      assertEqual(
        await h.getFieldAttr({ id: "password" }, "type"),
        "password",
        "Initially masked"
      );

      // Click toggle button inside password wrapper
      await h.page.evaluate(() => {
        const input = document.getElementById("password");
        const btn = input?.parentElement?.querySelector('button[type="button"]');
        if (!btn) throw new Error("Password toggle button not found");
        btn.click();
      });
      assertEqual(
        await h.getFieldAttr({ id: "password" }, "type"),
        "text",
        "Visible after toggle"
      );

      await demoLogin(h, "student");
      await h.clickButton(/^Sair$/i);
      await h.waitForPath(/^\/login$/);
    },
  },
  {
    id: "T1-A3-1",
    area: "A3",
    name: "Start Fácil session and verify stats bar and question card",
    async run(h) {
      await demoLogin(h, "student");
      await startDifficultyGame(h, "easy");

      const stats = await readGameStats(h);
      assertEqual(stats.score, 0, "Initial score 0");
      assertEqual(stats.correct, 0, "Initial correct 0");
      assertEqual(stats.total, 0, "Initial total 0");
      assert(await h.hasText(/Fácil/i), "Difficulty label Fácil visible");
      assert(await h.hasText(/PALAVRA:/i), "PALAVRA label visible");
      assert(await h.hasText(/QUEST[ÃA]O:/i), "QUESTÃO label visible");
      assert(await h.hasText(/TIPO:/i), "TIPO label visible");
      assertEqual(await h.getRadioCount(), 4, "4 radio options rendered");
    },
  },
  {
    id: "T1-A3-2",
    area: "A3",
    name: "Start Médio and Difícil sessions",
    async run(h) {
      await demoLogin(h, "student");
      await startDifficultyGame(h, "medium");
      assert(await h.hasText(/Médio/i), "Médio label visible");
      await endGameSession(h);

      await h.clickButton(/Jogar Novamente/i);
      await h.waitForPath(/^\/game$/);
      await startDifficultyGame(h, "hard");
      assert(await h.hasText(/Difícil/i), "Difícil label visible");
    },
  },
  {
    id: "T1-A3-3",
    area: "A3",
    name: "Select an option and submit Responder updates Total and loads next question",
    async run(h) {
      await demoLogin(h, "student");
      await startDifficultyGame(h, "easy");
      const res = await answerOneQuestion(h, 0);
      assertEqual(res.after.total, 1, "Total incremented to 1");
      await waitForQuestionReady(h, 1);
      assertEqual(await h.getRadioCount(), 4, "Next question has 4 radio options");
    },
  },
  {
    id: "T1-A3-4",
    area: "A3",
    name: "Answer multiple questions and observe live timer and consistent scoring",
    async run(h) {
      await demoLogin(h, "student");
      await startDifficultyGame(h, "easy");

      await answerOneQuestion(h, 0);
      await waitForQuestionReady(h, 1);
      await answerOneQuestion(h, 1);

      await h.page.waitForFunction(() => {
        const ps = Array.from(document.querySelectorAll("p"));
        const tempo = ps.find((p) => (p.innerText || "").trim() === "Tempo");
        const val = tempo?.nextElementSibling?.innerText?.trim() || "0:00";
        return val !== "0:00";
      }, null, { timeout: 5000 });

      const stats = await readGameStats(h);
      assertEqual(stats.total, 2, "Total should be 2");
      assertEqual(stats.score, stats.correct * 10, "Easy score = correct * 10");
    },
  },
  {
    id: "T1-A3-5",
    area: "A3",
    name: "Click Finalizar Sessão shows toast and redirects to /history",
    async run(h) {
      await demoLogin(h, "student");
      await startDifficultyGame(h, "easy");
      await answerOneQuestion(h, 0);
      await waitForQuestionReady(h, 1);
      await endGameSession(h);
      const summary = await readHistorySummary(h);
      assert(summary.sessions >= 1, "At least 1 session in history");
    },
  },
  {
    id: "T1-A4-1",
    area: "A4",
    name: "View /history as seeded demo student renders 4 summary cards and seeded sessions",
    async run(h) {
      await demoLogin(h, "student");
      await h.clickButton(/Histórico/i);
      await h.waitForPath(/^\/history$/);
      await h.findHeading(/Histórico de Jogo/i);
      const summary = await readHistorySummary(h);
      assert(!Number.isNaN(summary.sessions) && summary.sessions >= 1, "Seeded sessions >= 1");
      assert(!Number.isNaN(summary.totalScore), "Pontuação Total numeric");
      assert(/%$/.test(summary.accuracyText), "Acurácia ends with %");
      assert(!Number.isNaN(summary.answers), "Respostas numeric");
    },
  },
  {
    id: "T1-A4-2",
    area: "A4",
    name: "Play a game session and verify /history increments Sessões and Respostas",
    async run(h) {
      await demoLogin(h, "student");
      await h.goto("/history");
      await h.findHeading(/Histórico de Jogo/i);
      const before = await readHistorySummary(h);

      await h.clickButton(/Jogar Novamente/i);
      await h.waitForPath(/^\/game$/);
      await startDifficultyGame(h, "easy");
      const ans = await answerOneQuestion(h, 0);
      await waitForQuestionReady(h, 1);
      await endGameSession(h);

      const after = await readHistorySummary(h);
      assertEqual(after.sessions, before.sessions + 1, "Sessions incremented by 1");
      assertEqual(after.answers, before.answers + 1, "Total answers incremented by 1");
      assertEqual(
        after.totalScore,
        before.totalScore + ans.after.score,
        "Total score increased by session score"
      );
    },
  },
  {
    id: "T1-A4-3",
    area: "A4",
    name: "Inspect session details on /history shows per-question breakdown",
    async run(h) {
      await demoLogin(h, "student");
      await startDifficultyGame(h, "easy");
      const playedWord = await getCurrentWord(h);
      await answerOneQuestion(h, 0);
      await waitForQuestionReady(h, 1);
      await endGameSession(h);

      await inspectLatestSessionDetails(h, [playedWord]);
    },
  },
  {
    id: "T1-A4-4",
    area: "A4",
    name: "Click Jogar Novamente on /history navigates to /game",
    async run(h) {
      await demoLogin(h, "student");
      await h.goto("/history");
      await h.findHeading(/Histórico de Jogo/i);
      await h.clickButton(/Jogar Novamente/i);
      await h.waitForPath(/^\/game$/);
      await h.findButton(/Começar Jogo/i);
    },
  },
  {
    id: "T1-A4-5",
    area: "A4",
    name: "Reload /history directly while logged in persists route and sessions",
    async run(h) {
      await demoLogin(h, "student");
      await h.goto("/history");
      await h.findHeading(/Histórico de Jogo/i);
      await h.reload();
      await h.waitForPath(/^\/history$/, 8000);
      await h.findHeading(/Histórico de Jogo/i);
      const summary = await readHistorySummary(h);
      assert(summary.sessions >= 1, "Persisted sessions remain visible after reload");
    },
  },
  {
    id: "T1-A5-1",
    area: "A5",
    name: "View /admin as Admin renders 3 analytics sections with valid 0-100% accuracy",
    async run(h) {
      await demoLogin(h, "admin");
      await h.waitForText(/Atividade por Faixa Etária/i);
      await h.waitForText(/Escolas Mais Ativas/i);
      await h.waitForText(/Desempenho de Pontuação por Faixa Etária/i);
      assert(
        await h.hasVisibleElement(".recharts-responsive-container, svg.recharts-surface"),
        "Recharts chart should be visible"
      );

      const percentCheck = await h.page.evaluate(() => {
        const cells = Array.from(document.querySelectorAll("td"));
        const bad = [];
        let seenPercents = 0;
        for (const td of cells) {
          const m = (td.innerText || "").trim().match(/^(\d+(?:\.\d+)?)%$/);
          if (m) {
            seenPercents++;
            const num = parseFloat(m[1]);
            if (num < 0 || num > 100) bad.push(td.innerText.trim());
          }
        }
        return { bad, seenPercents };
      });
      assert(
        percentCheck.seenPercents >= 1,
        "Expected at least one accuracy percentage cell in /admin tables"
      );
      assertEqual(
        percentCheck.bad.length,
        0,
        `All accuracy percentages must be in 0..100%, found: ${percentCheck.bad.join(", ")}`
      );
    },
  },
  {
    id: "T1-A5-2",
    area: "A5",
    name: "Promote user to Professor on /admin persists across reload",
    async run(h) {
      await demoLogin(h, "admin");
      await h.waitForText(/Gerenciar Professores e Usuários/i);
      await h.findButton(/Promover a Professor/i);

      const countBefore = await h.page.evaluate(
        () =>
          Array.from(document.querySelectorAll("button")).filter((b) =>
            /Promover a Professor/i.test(b.innerText || "")
          ).length
      );
      assert(countBefore >= 1, "At least 1 promotable user exists");

      const dlg = await h.acceptNextConfirm(async () => {
        await h.clickButton(/Promover a Professor/i);
      });
      assert(dlg.triggered, "Confirm dialog should trigger on promotion");

      await h.page.waitForFunction(
        (before) =>
          Array.from(document.querySelectorAll("button")).filter((b) =>
            /Promover a Professor/i.test(b.innerText || "")
          ).length ===
          before - 1,
        countBefore,
        { timeout: 8000 }
      );

      await h.reload();
      await h.waitForPath(/^\/admin$/);
      await h.waitForText(/Gerenciar Professores e Usuários/i);
      const countAfterReload = await h.page.evaluate(
        () =>
          Array.from(document.querySelectorAll("button")).filter((b) =>
            /Promover a Professor/i.test(b.innerText || "")
          ).length
      );
      assertEqual(countAfterReload, countBefore - 1, "Promotion persisted across reload");
    },
  },
  {
    id: "T1-A5-3",
    area: "A5",
    name: "Access /admin as moderator (Professor) shows metrics & classes, hides user promotion",
    async run(h) {
      await demoLogin(h, "moderator");
      await h.waitForText(/Atividade por Faixa Etária/i);
      await h.waitForText(/Turma/i);
      assert(
        !(await h.hasButton(/Promover a Professor/i)),
        "Moderator must not see Promover a Professor"
      );
      await h.expectNoText(/Gerenciar Professores e Usuários/i);
    },
  },
  {
    id: "T1-A5-4",
    area: "A5",
    name: "Create a new class as Professor/Admin generates inviteCode",
    async run(h) {
      await demoLogin(h, "moderator");
      const inviteCode = await createTeacherClass(h, "Turma E2E 6A");
      assert(inviteCode.length >= 4, `Generated inviteCode looks valid: ${inviteCode}`);
    },
  },
  {
    id: "T1-A5-5",
    area: "A5",
    name: "View enrolled students in a teacher class",
    async run(h) {
      await demoLogin(h, "moderator");
      const inviteCode = await createTeacherClass(h, "Turma E2E 8B");
      await h.clickButton(/^Sair$/i);
      await h.waitForPath(/^\/login$/);

      const studentName = "Aluno Inscrito E2E";
      await registerStudent(h, {
        name: studentName,
        email: uniqueEmail("roster"),
        age: "13",
        school: "Escola Roster",
        password: "Password123!",
        inviteCode,
      });
      await h.waitForPath(/^\/login$/);

      await demoLogin(h, "moderator");
      await openTeacherClassStudents(h, "Turma E2E 8B");

      await h.waitForText(new RegExp(studentName, "i"), 8000);
    },
  },
  {
    id: "T1-A6-1",
    area: "A6",
    name: "Direct HTTP load & browser reload on / returns 200 and renders Home",
    async run(h) {
      const res = await fetch(`${h.baseUrl}/`);
      assertEqual(res.status, 200, "GET / returns 200");
      await h.goto("/");
      await h.findHeading(/Aprenda Palavras em Português/i);
      await h.reload();
      assertEqual(await h.currentPath(), "/", "Stays on / after reload");
      await h.findHeading(/Aprenda Palavras em Português/i);
    },
  },
  {
    id: "T1-A6-2",
    area: "A6",
    name: "Direct HTTP load & browser reload on /login and /register",
    async run(h) {
      for (const [route, heading] of [
        ["/login", /Bem-vindo/i],
        ["/register", /Criar Conta/i],
      ]) {
        const res = await fetch(`${h.baseUrl}${route}`);
        assertEqual(res.status, 200, `GET ${route} returns 200`);
        await h.goto(route);
        await h.findHeading(heading);
        await h.reload();
        assertEqual(await h.currentPath(), route, `Stays on ${route} after reload`);
        await h.findHeading(heading);
      }
    },
  },
  {
    id: "T1-A6-3",
    area: "A6",
    name: "Direct browser reload on /game when authenticated preserves session",
    async run(h) {
      await demoLogin(h, "student");
      await h.reload();
      await h.waitForPath(/^\/game$/, 8000);
      await h.findHeading(/Jogo de Palavras/i);
      await h.waitForText(/Bem-vindo,/i);
    },
  },
  {
    id: "T1-A6-4",
    area: "A6",
    name: "Direct browser reload on /history and /admin when authenticated",
    async run(h) {
      await demoLogin(h, "student");
      await h.goto("/history");
      await h.findHeading(/Histórico de Jogo/i);
      await h.reload();
      await h.waitForPath(/^\/history$/, 8000);
      await h.findHeading(/Histórico de Jogo/i);

      await h.clearLocalStorage();
      await demoLogin(h, "admin");
      await h.reload();
      await h.waitForPath(/^\/admin$/, 8000);
      await h.findHeading(/Dashboard Administrativo/i);
    },
  },
  {
    id: "T1-A6-5",
    area: "A6",
    name: "Direct load on /404 and /non-existent-route renders NotFound and Go Home returns to /",
    async run(h) {
      await h.goto("/404");
      await h.findHeading(/404/);
      await h.waitForText(/Page Not Found/i);
      await h.clickButton(/Go Home/i);
      await h.waitForPath(/^\/$/);

      await h.goto("/non-existent-route");
      await h.findHeading(/404/);
      await h.clickButton(/Go Home/i);
      await h.waitForPath(/^\/$/);

      // Verify SPA server semantics for missing favicon, missing static asset, and traversal
      const fav = await fetch(`${h.baseUrl}/favicon.ico`);
      assertEqual(fav.status, 204, "Missing /favicon.ico returns 204");
      const missingJs = await fetch(`${h.baseUrl}/assets/definitely-missing-file.js`);
      assertEqual(missingJs.status, 404, "Missing .js asset returns 404");
      const traversalStatus = await rawHttpGetStatus(h.baseUrl, "/../package.json");
      assertEqual(traversalStatus, 403, "Path traversal returns 403");
    },
  },
];
