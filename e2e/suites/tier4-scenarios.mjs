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
  readHistorySummary,
  registerStudent,
  resetDemoFromHome,
  startDifficultyGame,
  uniqueEmail,
  waitForQuestionReady,
} from "./common.mjs";

export const tier4Tests = [
  {
    id: "T4-1",
    area: "Scenario",
    name: "First-Time Portfolio Visitor (1-Click Student Journey)",
    async run(h) {
      await h.goto("/");
      await h.findHeading(/Aprenda Palavras em Português/i);
      await h.clickButton(/^Login$/i);
      await h.waitForPath(/^\/login$/);

      await demoLogin(h, "student");
      await startDifficultyGame(h, "medium");
      const playedWord = await getCurrentWord(h);
      await answerOneQuestion(h, 0);
      await waitForQuestionReady(h, 1);
      await answerOneQuestion(h, 1);
      await waitForQuestionReady(h, 2);
      await answerOneQuestion(h, 2);
      await waitForQuestionReady(h, 3);
      await endGameSession(h);

      const summary = await readHistorySummary(h);
      assert(summary.sessions >= 1 && summary.answers >= 3, "History reflects 3 answered questions");

      // Inspect session details (always verify, never silently skip)
      await inspectLatestSessionDetails(h, [playedWord]);

      // Direct reload on /history
      await h.reload();
      await h.waitForPath(/^\/history$/, 8000);
      await h.findHeading(/Histórico de Jogo/i);

      await h.clickButton(/^Sair$/i);
      await h.waitForPath(/^\/login$/);
    },
  },
  {
    id: "T4-2",
    area: "Scenario",
    name: "Self-Registered Student Onboarding Journey",
    async run(h) {
      await h.goto("/");
      await h.clickButton(/Começar Agora/i);
      await h.waitForPath(/^\/register$/);

      const email = uniqueEmail("onboarding");
      await registerStudent(h, {
        name: "Beatriz Almeida",
        email,
        age: "15",
        school: "Colégio Novo Horizonte",
        password: "Password123!",
      });
      await h.waitForText(/Conta criada com sucesso/i, 8000);
      await h.waitForPath(/^\/login$/, 8000);

      await loginWithCreds(h, email, "Password123!", /^\/game$/);
      await h.goto("/history");
      await h.waitForText(/Você ainda não jogou nenhuma sessão\./i);
      assertEqual((await readHistorySummary(h)).sessions, 0, "Starts with 0 sessions");

      await h.clickButton(/Começar Jogo/i);
      await h.waitForPath(/^\/game$/);
      await startDifficultyGame(h, "easy");
      await answerOneQuestion(h, 0);
      await waitForQuestionReady(h, 1);
      await answerOneQuestion(h, 1);
      await waitForQuestionReady(h, 2);
      await endGameSession(h);

      const after = await readHistorySummary(h);
      assertEqual(after.sessions, 1, "1 session recorded");
      assertEqual(after.answers, 2, "2 answers recorded");
    },
  },
  {
    id: "T4-3",
    area: "Scenario",
    name: "Professor / Educator Class & Student Tracking Journey",
    async run(h) {
      await demoLogin(h, "moderator");
      await h.waitForText(/Atividade por Faixa Etária/i);
      await h.waitForText(/Escolas Mais Ativas/i);

      const inviteCode = await createTeacherClass(h, "Turma 7º A");
      await h.clickButton(/^Sair$/i);
      await h.waitForPath(/^\/login$/);

      const studentName = "Gabriel Oliveira";
      const studentEmail = uniqueEmail("proftrack");
      await registerStudent(h, {
        name: studentName,
        email: studentEmail,
        age: "13",
        school: "Escola Estadual Centro",
        password: "Password123!",
        inviteCode,
      });
      await h.waitForPath(/^\/login$/);

      await loginWithCreds(h, studentEmail, "Password123!", /^\/game$/);
      await startDifficultyGame(h, "easy");
      await answerOneQuestion(h, 0);
      await waitForQuestionReady(h, 1);
      await endGameSession(h);

      await h.clickButton(/^Sair$/i);
      await h.waitForPath(/^\/login$/);

      await demoLogin(h, "moderator");
      await openTeacherClassStudents(h, "Turma 7º A");

      await h.waitForText(new RegExp(studentName, "i"), 8000);
    },
  },
  {
    id: "T4-4",
    area: "Scenario",
    name: "Administrator Governance & Promotion Journey",
    async run(h) {
      const candidateName = "Candidata Docente";
      const candidateEmail = uniqueEmail("gov");
      await registerStudent(h, {
        name: candidateName,
        email: candidateEmail,
        age: "31",
        school: "Instituto Federal",
        password: "Password123!",
      });
      await h.waitForPath(/^\/login$/);

      await demoLogin(h, "admin");
      await h.waitForText(/Atividade por Faixa Etária/i);
      await h.waitForText(/Escolas Mais Ativas/i);
      await h.waitForText(/Desempenho de Pontuação por Faixa Etária/i);
      await h.waitForText(new RegExp(candidateEmail, "i"));

      const dlg = await h.acceptNextConfirm(async () => {
        await h.page.evaluate((email) => {
          const rows = Array.from(document.querySelectorAll("tr"));
          const row = rows.find((r) => (r.innerText || "").includes(email));
          if (!row) throw new Error(`Row for ${email} not found`);
          const btn = Array.from(row.querySelectorAll("button")).find((b) =>
            /Promover a Professor/i.test(b.innerText || "")
          );
          if (!btn) throw new Error(`Promote button for ${email} not found`);
          btn.click();
        }, candidateEmail);
      });
      assert(dlg.triggered, "Promotion confirm must trigger");

      await h.page.waitForFunction((email) => {
        const rows = Array.from(document.querySelectorAll("tr"));
        const row = rows.find((r) => (r.innerText || "").includes(email));
        return Boolean(row && /Professor/i.test(row.innerText || "") && !row.querySelector("button"));
      }, candidateEmail, { timeout: 8000 });

      await h.reload();
      await h.waitForPath(/^\/admin$/);
      await h.waitForText(new RegExp(candidateEmail, "i"));

      await h.clickButton(/^Sair$/i);
      await h.waitForPath(/^\/login$/);

      await loginWithCreds(h, candidateEmail, "Password123!", /^\/admin$/);
      await h.findHeading(/Dashboard Administrativo|Painel/i);
    },
  },
  {
    id: "T4-5",
    area: "Scenario",
    name: "Portfolio Reviewer Reset & Multi-Role Direct-Reload Audit",
    async run(h) {
      // Student exploration
      await demoLogin(h, "student");
      await h.reload();
      await h.waitForPath(/^\/game$/);
      await h.findHeading(/Jogo de Palavras/i);
      await h.goto("/history");
      await h.reload();
      await h.waitForPath(/^\/history$/);
      await h.findHeading(/Histórico de Jogo/i);

      // Reset Demo from Home
      await resetDemoFromHome(h);

      // Admin exploration & direct reloads
      await demoLogin(h, "admin");
      await h.reload();
      await h.waitForPath(/^\/admin$/);
      await h.findHeading(/Dashboard Administrativo/i);

      await h.goto("/game");
      await h.reload();
      await h.waitForPath(/^\/game$/);
      await h.findHeading(/Jogo de Palavras/i);

      await h.goto("/history");
      await h.reload();
      await h.waitForPath(/^\/history$/);
      await h.findHeading(/Histórico de Jogo/i);

      await h.clickButton(/^Sair$/i);
      await h.waitForPath(/^\/login$/);
      await h.reload();
      await h.waitForPath(/^\/login$/);
      await h.findHeading(/Bem-vindo/i);

      await h.goto("/register");
      await h.reload();
      await h.waitForPath(/^\/register$/);
      await h.findHeading(/Criar Conta/i);

      await h.goto("/404");
      await h.reload();
      await h.findHeading(/404/);
      await h.clickButton(/Go Home/i);
      await h.waitForPath(/^\/$/);
      await h.findHeading(/Aprenda Palavras em Português/i);
    },
  },
];
