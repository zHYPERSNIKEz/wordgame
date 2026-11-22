import {
  answerOneQuestion,
  assert,
  assertEqual,
  createTeacherClass,
  demoLogin,
  endGameSession,
  loginWithCreds,
  openTeacherClassStudents,
  readHistorySummary,
  registerStudent,
  resetDemoFromHome,
  startDifficultyGame,
  uniqueEmail,
  waitForQuestionReady,
} from "./common.mjs";

export const tier3Tests = [
  {
    id: "T3-1",
    area: "Combination",
    name: "Register with inviteCode enrolls student into Professor's class student roster",
    async run(h) {
      await demoLogin(h, "moderator");
      const inviteCode = await createTeacherClass(h, "Turma Combinada 3A");
      await h.clickButton(/^Sair$/i);
      await h.waitForPath(/^\/login$/);

      const studentName = "Estudante Turma 3A";
      const studentEmail = uniqueEmail("t31");
      await registerStudent(h, {
        name: studentName,
        email: studentEmail,
        age: "14",
        school: "Escola Combinada",
        password: "Password123!",
        inviteCode,
      });
      await h.waitForPath(/^\/login$/);

      await demoLogin(h, "moderator");
      await openTeacherClassStudents(h, "Turma Combinada 3A");

      await h.waitForText(new RegExp(studentName, "i"), 8000);
    },
  },
  {
    id: "T3-2",
    area: "Combination",
    name: "Admin promotes student to Professor and promoted user logs in directly to /admin",
    async run(h) {
      const promoName = "Novo Professor T32";
      const promoEmail = uniqueEmail("promo");
      await registerStudent(h, {
        name: promoName,
        email: promoEmail,
        age: "28",
        school: "Escola Promoção",
        password: "Password123!",
      });
      await h.waitForPath(/^\/login$/);

      await demoLogin(h, "admin");
      await h.waitForText(/Gerenciar Professores e Usuários/i);
      await h.waitForText(new RegExp(promoEmail, "i"));

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
        }, promoEmail);
      });
      assert(dlg.triggered, "Promotion confirmation dialog must fire");

      await h.page.waitForFunction((email) => {
        const rows = Array.from(document.querySelectorAll("tr"));
        const row = rows.find((r) => (r.innerText || "").includes(email));
        return Boolean(row && /Professor/i.test(row.innerText || "") && !row.querySelector("button"));
      }, promoEmail, { timeout: 8000 });

      await h.clickButton(/^Sair$/i);
      await h.waitForPath(/^\/login$/);

      await loginWithCreds(h, promoEmail, "Password123!", /^\/admin$/);
      await h.findHeading(/Dashboard Administrativo|Painel/i);
    },
  },
  {
    id: "T3-3",
    area: "Combination",
    name: "Game session -> History update -> Admin metrics consistency",
    async run(h) {
      await demoLogin(h, "student");
      await startDifficultyGame(h, "easy");
      await answerOneQuestion(h, 0);
      await waitForQuestionReady(h, 1);
      await answerOneQuestion(h, 1);
      await waitForQuestionReady(h, 2);
      await endGameSession(h);

      const summary = await readHistorySummary(h);
      assert(summary.sessions >= 1, "History shows session");
      assert(summary.answers >= 2, "History reflects answers");

      await h.clickButton(/^Sair$/i);
      await h.waitForPath(/^\/login$/);

      await demoLogin(h, "admin");
      await h.waitForText(/Atividade por Faixa Etária/i);
      await h.waitForText(/Escolas Mais Ativas/i);
      await h.waitForText(/Desempenho de Pontuação por Faixa Etária/i);
      await h.expectNoText(/NaN|Infinity/i);
    },
  },
  {
    id: "T3-4",
    area: "Combination",
    name: "Active game logout (accept confirm) finalizes and records session in /history",
    async run(h) {
      const email = uniqueEmail("logoutsave");
      await registerStudent(h, {
        name: "Aluno Logout Ativo",
        email,
        age: "17",
        password: "Password123!",
      });
      await h.waitForPath(/^\/login$/);
      await loginWithCreds(h, email, "Password123!", /^\/game$/);

      await startDifficultyGame(h, "easy");
      await answerOneQuestion(h, 0);
      await waitForQuestionReady(h, 1);

      const dlg = await h.acceptNextConfirm(async () => {
        await h.clickButton(/^Sair$/i);
      });
      assert(dlg.triggered, "Active game logout must ask confirmation");
      await h.waitForPath(/^\/login$/, 8000);

      await loginWithCreds(h, email, "Password123!", /^\/game$/);
      await h.goto("/history");
      await h.findHeading(/Histórico de Jogo/i);
      const summary = await readHistorySummary(h);
      assertEqual(summary.sessions, 1, "Ended session recorded on logout");
      assertEqual(summary.answers, 1, "1 answer recorded in ended session");
    },
  },
  {
    id: "T3-5",
    area: "Combination",
    name: "Multi-difficulty Game (Fácil + Difícil) aggregates accurately in /history",
    async run(h) {
      const email = uniqueEmail("multidiff");
      await registerStudent(h, {
        name: "Aluno Multi Dificuldade",
        email,
        age: "16",
        password: "Password123!",
      });
      await h.waitForPath(/^\/login$/);
      await loginWithCreds(h, email, "Password123!", /^\/game$/);

      await startDifficultyGame(h, "easy");
      const r1 = await answerOneQuestion(h, 0);
      await waitForQuestionReady(h, 1);
      await endGameSession(h);

      await h.clickButton(/Jogar Novamente/i);
      await h.waitForPath(/^\/game$/);
      await startDifficultyGame(h, "hard");
      const r2 = await answerOneQuestion(h, 0);
      await waitForQuestionReady(h, 1);
      await endGameSession(h);

      const summary = await readHistorySummary(h);
      assertEqual(summary.sessions, 2, "2 sessions aggregated");
      assertEqual(summary.answers, 2, "2 total answers aggregated");
      assertEqual(
        summary.totalScore,
        r1.after.score + r2.after.score,
        "Pontuação Total equals sum of Fácil and Difícil scores"
      );
      const expectedAcc = ((r1.after.correct + r2.after.correct) / 2) * 100;
      assertEqual(
        summary.accuracyText,
        `${expectedAcc.toFixed(1)}%`,
        "Aggregated accuracy matches expected percentage"
      );
    },
  },
  {
    id: "T3-6",
    area: "Combination",
    name: "Custom mutations -> Reset Demo -> Demo Login restores seeded state",
    async run(h) {
      const email = uniqueEmail("resetcombo");
      await registerStudent(h, {
        name: "Custom Combo User",
        email,
        age: "19",
        password: "Password123!",
      });
      await h.waitForPath(/^\/login$/);
      await loginWithCreds(h, email, "Password123!", /^\/game$/);
      await startDifficultyGame(h, "medium");
      await answerOneQuestion(h, 0);
      await waitForQuestionReady(h, 1);
      await endGameSession(h);

      await resetDemoFromHome(h);

      // Custom user must no longer exist
      await h.goto("/login");
      await h.fillField({ id: "email", name: "email", labelRegex: /^Email$/i }, email);
      await h.fillField({ id: "password", name: "password", labelRegex: /^Senha$/i }, "Password123!");
      await h.allowExpectedMutationErrors(async () => {
        await h.clickButton(/Fazer Login/i);
        await h.waitForText(/erro|inv[áa]lid|incorret|n[ãa]o encontrad/i, 6000);
      });

      // Demo logins still work cleanly with seeded data
      await demoLogin(h, "student");
      await h.goto("/history");
      const summary = await readHistorySummary(h);
      assert(summary.sessions >= 1, "Seeded student sessions intact after Reset Demo");
    },
  },
];
