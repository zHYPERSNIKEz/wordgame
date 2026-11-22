import {
  assert,
  assertEqual,
  demoLogin,
  endGameSession,
  loginWithCreds,
  readHistorySummary,
  registerStudent,
  resetDemoFromHome,
  startDifficultyGame,
  uniqueEmail,
} from "./common.mjs";

export const tier2Tests = [
  {
    id: "T2-A1-1",
    area: "A1",
    name: "Unauthenticated user on / cannot see Dashboard or Jogar",
    async run(h) {
      await h.goto("/");
      await h.findHeading(/Aprenda Palavras em Português/i);
      await h.findButton(/^Login$/i);
      await h.findButton(/^Cadastro$/i);
      assert(!(await h.hasButton(/^Jogar$/i)), "Jogar must be hidden when unauthenticated");
      assert(!(await h.hasButton(/Dashboard/i)), "Dashboard must be hidden when unauthenticated");
    },
  },
  {
    id: "T2-A1-2",
    area: "A1",
    name: "Student (user) on / sees Jogar but does not see Dashboard",
    async run(h) {
      await demoLogin(h, "student");
      await h.goto("/");
      await h.findButton(/^Jogar$/i);
      assert(!(await h.hasButton(/Dashboard/i)), "Student must not see Dashboard on /");
    },
  },
  {
    id: "T2-A1-3",
    area: "A1",
    name: "Zero broken %VITE_ANALYTICS_ENDPOINT% requests or tags on /",
    async run(h) {
      await h.goto("/");
      await h.findHeading(/Aprenda Palavras em Português/i);
      const html = await h.page.content();
      assert(
        !html.includes("%VITE_ANALYTICS_ENDPOINT%"),
        "Unexpanded %VITE_ANALYTICS_ENDPOINT% tag must not be present in built HTML"
      );
      h.assertZeroErrors();
    },
  },
  {
    id: "T2-A1-4",
    area: "A1",
    name: "Reset Demo while logged in as custom user clears custom session cleanly",
    async run(h) {
      const email = uniqueEmail("customreset");
      await registerStudent(h, {
        name: "Custom Reset User",
        email,
        age: "18",
        password: "Password123!",
      });
      await h.waitForPath(/^\/login$/);
      await loginWithCreds(h, email, "Password123!", /^\/game$/);

      await resetDemoFromHome(h);
      await h.goto("/game");
      // Custom user session cleared or redirected to /login
      await h.waitForPath(/^\/login$/, 8000);
    },
  },
  {
    id: "T2-A1-5",
    area: "A1",
    name: "Navigate to /404 and click Go Home returns to / cleanly",
    async run(h) {
      await h.goto("/404");
      await h.findHeading(/404/);
      await h.clickButton(/Go Home/i);
      await h.waitForPath(/^\/$/);
      await h.findHeading(/Aprenda Palavras em Português/i);
    },
  },
  {
    id: "T2-A2-1",
    area: "A2",
    name: "Register with duplicate email fails with error toast and stays on /register",
    async run(h) {
      const email = uniqueEmail("dup");
      await registerStudent(h, {
        name: "First User",
        email,
        age: "15",
        password: "Password123!",
      });
      await h.waitForPath(/^\/login$/);

      await h.allowExpectedMutationErrors(async () => {
        await registerStudent(h, {
          name: "Second User",
          email,
          age: "16",
          password: "Password123!",
        });
        await h.waitForToast(
          /j[áa]\s*(est[áa]\s*)?cadastrad|existe|duplicad|already\s*(registered|exists)|erro|uso/i,
          6000
        );
      });
      assertEqual(await h.currentPath(), "/register", "Must remain on /register");
    },
  },
  {
    id: "T2-A2-2",
    area: "A2",
    name: "Register with mismatched passwords shows ❌ indicator and rejects submission",
    async run(h) {
      await h.allowExpectedMutationErrors(async () => {
        await registerStudent(h, {
          name: "Mismatch User",
          email: uniqueEmail("mismatch"),
          age: "15",
          password: "Password123!",
          passwordConfirm: "Different456!",
        });
        await h.waitForText(/❌/);
        await h.waitForToast(
          /senhas|coincidem|iguais|don't match|n[ãa]o conferem|erro/i,
          6000
        );
      });
      assertEqual(await h.currentPath(), "/register", "Must stay on /register on mismatch");
    },
  },
  {
    id: "T2-A2-3",
    area: "A2",
    name: "Register with short password (<6) or out-of-range age (<5 or >120) does not create account",
    async run(h) {
      const shortPwEmail = uniqueEmail("shortpw");
      const youngEmail = uniqueEmail("young");
      const oldEmail = uniqueEmail("old");

      // Short password
      await h.allowExpectedMutationErrors(async () => {
        await registerStudent(h, {
          name: "Short Pass",
          email: shortPwEmail,
          age: "15",
          password: "123",
        });
        await h.waitForToast(
          /at least 6|pelo menos 6|m[íi]nimo\s*(de)?\s*6|too short|curta|erro/i,
          6000
        );
      });
      assertEqual(await h.currentPath(), "/register", "Short password must not succeed");

      // Invalid age (< 5)
      const youngBlocked = await h.allowExpectedMutationErrors(async () => {
        await registerStudent(h, {
          name: "Too Young",
          email: youngEmail,
          age: "3",
          password: "Password123!",
        });
        const isInvalid = await h.page.evaluate(() =>
          Boolean(document.querySelector("input:invalid"))
        );
        if (isInvalid) return true;
        await h.waitForToast(/inv[áa]lid|entre 5 e 120|must be.*5.*120|erro/i, 6000);
        return true;
      });
      assertEqual(await h.currentPath(), "/register", "Age < 5 must not succeed");
      assert(youngBlocked, "Age < 5 must trigger validation or error feedback");

      // Invalid age (> 120)
      const oldBlocked = await h.allowExpectedMutationErrors(async () => {
        await registerStudent(h, {
          name: "Too Old",
          email: oldEmail,
          age: "150",
          password: "Password123!",
        });
        const isInvalid = await h.page.evaluate(() =>
          Boolean(document.querySelector("input:invalid"))
        );
        if (isInvalid) return true;
        await h.waitForToast(/inv[áa]lid|entre 5 e 120|must be.*5.*120|erro/i, 6000);
        return true;
      });
      assertEqual(await h.currentPath(), "/register", "Age > 120 must not succeed");
      assert(oldBlocked, "Age > 120 must trigger validation or error feedback");

      // Confirm invalid accounts were NOT created by attempting login
      for (const [badEmail, badPass] of [
        [shortPwEmail, "123"],
        [youngEmail, "Password123!"],
      ]) {
        await h.goto("/login");
        await h.findHeading(/Bem-vindo/i);
        await h.fillField({ id: "email", name: "email", labelRegex: /^Email$/i }, badEmail);
        await h.fillField({ id: "password", name: "password", labelRegex: /^Senha$/i }, badPass);
        await h.allowExpectedMutationErrors(async () => {
          await h.clickButton(/Fazer Login/i);
          await h.waitForToast(/erro|inv[áa]lid|incorret|n[ãa]o encontrad/i, 6000);
        });
        assertEqual(await h.currentPath(), "/login", `Account ${badEmail} must not have been created`);
      }
    },
  },
  {
    id: "T2-A2-4",
    area: "A2",
    name: "Register with invalid inviteCode surfaces error and blocks registration",
    async run(h) {
      await h.allowExpectedMutationErrors(async () => {
        await registerStudent(h, {
          name: "Bad Invite Student",
          email: uniqueEmail("badinvite"),
          age: "14",
          password: "Password123!",
          inviteCode: "INVALID-CODE-999999",
        });
        await h.waitForToast(
          /inv[áa]lid|n[ãa]o encontrad|invalid invite|invite.*not found|erro/i,
          6000
        );
      });
      assertEqual(await h.currentPath(), "/register", "Invalid inviteCode keeps user on /register");
    },
  },
  {
    id: "T2-A2-5",
    area: "A2",
    name: "Wrong login creds show error; logged-in user visiting /login auto-redirects",
    async run(h) {
      await h.goto("/login");
      await h.fillField({ id: "email", name: "email", labelRegex: /^Email$/i }, "naoexiste@exemplo.com");
      await h.fillField({ id: "password", name: "password", labelRegex: /^Senha$/i }, "WrongPass123!");
      await h.allowExpectedMutationErrors(async () => {
        await h.clickButton(/Fazer Login/i);
        await h.waitForToast(/erro|inv[áa]lid|incorret|n[ãa]o encontrad/i, 6000);
      });
      assertEqual(await h.currentPath(), "/login", "Wrong creds stay on /login");

      await demoLogin(h, "student");
      await h.goto("/login");
      await h.waitForPath(/^\/game$/, 6000);
    },
  },
  {
    id: "T2-A3-1",
    area: "A3",
    name: "Unauthenticated direct visit to /game redirects to /login",
    async run(h) {
      await h.goto("/game");
      await h.waitForPath(/^\/login$/, 8000);
      await h.findHeading(/Bem-vindo/i);
    },
  },
  {
    id: "T2-A3-2",
    area: "A3",
    name: "Responder button is disabled before selecting a radio option",
    async run(h) {
      await demoLogin(h, "student");
      await startDifficultyGame(h, "easy");
      assertEqual(
        await h.isButtonDisabled(/^Responder$/i),
        true,
        "Responder must be disabled until an option is selected"
      );
    },
  },
  {
    id: "T2-A3-3",
    area: "A3",
    name: "Click Voltar in difficulty selector returns to Começar Jogo screen",
    async run(h) {
      await demoLogin(h, "student");
      await h.clickButton(/Começar Jogo/i);
      await h.findHeading(/Escolha o Nível de Dificuldade/i);
      await h.clickButton(/^Voltar$/i);
      await h.findHeading(/Pronto para jogar\?/i);
      await h.findButton(/Começar Jogo/i);
    },
  },
  {
    id: "T2-A3-4",
    area: "A3",
    name: "Click Sair during active game and cancel confirm keeps user in active game",
    async run(h) {
      await demoLogin(h, "student");
      await startDifficultyGame(h, "easy");

      const dlg = await h.dismissNextConfirm(async () => {
        await h.clickButton(/^Sair$/i);
      });
      assert(dlg.triggered, "Confirm dialog should appear on active game logout");
      assertEqual(await h.currentPath(), "/game", "Should stay on /game when confirm dismissed");
      assert(await h.hasText(/PALAVRA:/i), "Active question card remains visible");
    },
  },
  {
    id: "T2-A3-5",
    area: "A3",
    name: "Click Finalizar Sessão with 0 answered questions ends cleanly without NaN",
    async run(h) {
      await demoLogin(h, "student");
      await startDifficultyGame(h, "easy");
      await endGameSession(h);
      await h.expectNoText(/NaN|Infinity/i);
    },
  },
  {
    id: "T2-A4-1",
    area: "A4",
    name: "Unauthenticated direct visit to /history redirects to /login",
    async run(h) {
      await h.goto("/history");
      await h.waitForPath(/^\/login$/, 8000);
      await h.findHeading(/Bem-vindo/i);
    },
  },
  {
    id: "T2-A4-2",
    area: "A4",
    name: "Newly registered student with 0 sessions sees empty state on /history",
    async run(h) {
      const email = uniqueEmail("emptyhist");
      await registerStudent(h, {
        name: "Aluno Sem Sessões",
        email,
        age: "14",
        password: "Password123!",
      });
      await h.waitForPath(/^\/login$/);
      await loginWithCreds(h, email, "Password123!", /^\/game$/);

      await h.goto("/history");
      await h.findHeading(/Histórico de Jogo/i);
      await h.waitForText(/Você ainda não jogou nenhuma sessão\./i);
      const summary = await readHistorySummary(h);
      assertEqual(summary.sessions, 0, "0 sessions");
      assertEqual(summary.accuracyText, "0%", "0% accuracy");
      await h.findButton(/Começar Jogo/i);
    },
  },
  {
    id: "T2-A4-3",
    area: "A4",
    name: "Click Começar Jogo from empty /history navigates to /game",
    async run(h) {
      const email = uniqueEmail("histcta");
      await registerStudent(h, {
        name: "Aluno CTA",
        email,
        age: "14",
        password: "Password123!",
      });
      await h.waitForPath(/^\/login$/);
      await loginWithCreds(h, email, "Password123!", /^\/game$/);

      await h.goto("/history");
      await h.waitForText(/Você ainda não jogou nenhuma sessão\./i);
      await h.clickButton(/Começar Jogo/i);
      await h.waitForPath(/^\/game$/);
      await h.findButton(/Começar Jogo/i);
    },
  },
  {
    id: "T2-A4-4",
    area: "A4",
    name: "No NaN% or Infinity in /history cards when totalAnswers === 0 after 0-answer session",
    async run(h) {
      const email = uniqueEmail("zeroans");
      await registerStudent(h, {
        name: "Aluno Zero Respostas",
        email,
        age: "15",
        password: "Password123!",
      });
      await h.waitForPath(/^\/login$/);
      await loginWithCreds(h, email, "Password123!", /^\/game$/);

      await startDifficultyGame(h, "easy");
      await endGameSession(h);

      const summary = await readHistorySummary(h);
      assertEqual(summary.sessions, 1, "1 session recorded");
      assertEqual(summary.answers, 0, "0 answers recorded");
      assertEqual(summary.accuracyText, "0%", "Accuracy is 0% (not NaN%)");
      await h.expectNoText(/NaN|Infinity/i);
    },
  },
  {
    id: "T2-A4-5",
    area: "A4",
    name: "Logout from /history clears session and revisiting /history redirects to /login",
    async run(h) {
      await demoLogin(h, "student");
      await h.goto("/history");
      await h.findHeading(/Histórico de Jogo/i);
      await h.clickButton(/^Sair$/i);
      await h.waitForPath(/^\/login$/);

      await h.goto("/history");
      await h.waitForPath(/^\/login$/, 8000);
    },
  },
  {
    id: "T2-A5-1",
    area: "A5",
    name: "Unauthenticated direct visit to /admin redirects to /login",
    async run(h) {
      await h.goto("/admin");
      await h.waitForPath(/^\/login$/, 8000);
      await h.findHeading(/Bem-vindo/i);
    },
  },
  {
    id: "T2-A5-2",
    area: "A5",
    name: "Student (user) directly visits /admin and redirects to /game",
    async run(h) {
      await demoLogin(h, "student");
      await h.goto("/admin");
      await h.waitForPath(/^\/game$/, 8000);
      await h.findHeading(/Jogo de Palavras/i);
    },
  },
  {
    id: "T2-A5-3",
    area: "A5",
    name: "Click Promover a Professor and cancel confirm leaves user role unchanged",
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

      const dlg = await h.dismissNextConfirm(async () => {
        await h.clickButton(/Promover a Professor/i);
      });
      assert(dlg.triggered, "Confirm dialog must trigger");

      const countAfter = await h.page.evaluate(
        () =>
          Array.from(document.querySelectorAll("button")).filter((b) =>
            /Promover a Professor/i.test(b.innerText || "")
          ).length
      );
      assertEqual(countAfter, countBefore, "Canceling confirm must not promote user");
    },
  },
  {
    id: "T2-A5-4",
    area: "A5",
    name: "Moderator (Professor) on /admin cannot see or trigger user promotion",
    async run(h) {
      await demoLogin(h, "moderator");
      await h.waitForText(/Atividade por Faixa Etária/i);
      assert(
        !(await h.hasButton(/Promover a Professor/i)),
        "Professor must not see Promover a Professor"
      );
      await h.expectNoText(/Gerenciar Professores e Usuários/i);
    },
  },
  {
    id: "T2-A5-5",
    area: "A5",
    name: "Teacher attempts to create class with empty name and validation blocks creation",
    async run(h) {
      await demoLogin(h, "moderator");
      await h.findInputByLabelOrAttr({
        id: "className",
        name: "className",
        labelRegex: /Nome.*Turma|Nova Turma|Turma/i,
        placeholderRegex: /turma|nome|7º/i,
      });
      const beforeStats = await h.page.evaluate(() => ({
        codes: document.querySelectorAll("[data-invite-code], code").length,
        rows: document.querySelectorAll(
          "tr, li:not([data-sonner-toast]):not([data-sonner-toaster] *)"
        ).length,
        studentBtns: Array.from(document.querySelectorAll('button, [role="button"]')).filter((b) =>
          /Ver Alunos|Alunos/i.test(b.innerText || b.textContent || "")
        ).length,
      }));
      await h.fillField(
        {
          id: "className",
          name: "className",
          labelRegex: /Nome.*Turma|Nova Turma|Turma/i,
          placeholderRegex: /turma|nome|7º/i,
        },
        ""
      );
      await h.clickButton(/Criar Turma|Nova Turma|Adicionar Turma/i);
      const hasInvalid = await h.page.evaluate(() =>
        Boolean(document.querySelector("input:invalid"))
      );
      if (!hasInvalid) {
        await h.waitForToast(/nome|turma|caracteres|obrigat[óo]ri|at least|erro/i, 6000);
      }

      const afterStats = await h.page.evaluate(() => ({
        codes: document.querySelectorAll("[data-invite-code], code").length,
        rows: document.querySelectorAll(
          "tr, li:not([data-sonner-toast]):not([data-sonner-toaster] *)"
        ).length,
        studentBtns: Array.from(document.querySelectorAll('button, [role="button"]')).filter((b) =>
          /Ver Alunos|Alunos/i.test(b.innerText || b.textContent || "")
        ).length,
      }));
      assertEqual(await h.currentPath(), "/admin");
      assertEqual(afterStats.codes, beforeStats.codes, "Empty class must not add invite badge");
      assertEqual(afterStats.rows, beforeStats.rows, "Empty class must not add table/list row");
      assertEqual(
        afterStats.studentBtns,
        beforeStats.studentBtns,
        "Empty class must not add student-view button"
      );
    },
  },
  {
    id: "T2-A6-1",
    area: "A6",
    name: "Direct reload on /game when unauthenticated redirects cleanly to /login",
    async run(h) {
      await h.goto("/game");
      await h.waitForPath(/^\/login$/, 8000);
      await h.reload();
      await h.waitForPath(/^\/login$/, 8000);
    },
  },
  {
    id: "T2-A6-2",
    area: "A6",
    name: "Direct reload on /history when unauthenticated redirects cleanly to /login",
    async run(h) {
      await h.goto("/history");
      await h.waitForPath(/^\/login$/, 8000);
      await h.reload();
      await h.waitForPath(/^\/login$/, 8000);
    },
  },
  {
    id: "T2-A6-3",
    area: "A6",
    name: "Direct reload on /admin when unauthenticated redirects cleanly to /login",
    async run(h) {
      await h.goto("/admin");
      await h.waitForPath(/^\/login$/, 8000);
      await h.reload();
      await h.waitForPath(/^\/login$/, 8000);
    },
  },
  {
    id: "T2-A6-4",
    area: "A6",
    name: "Direct load and reload on /admin as Student (user) redirects cleanly to /game",
    async run(h) {
      await demoLogin(h, "student");
      await h.goto("/admin");
      await h.waitForPath(/^\/game$/, 8000);
      await h.reload();
      await h.waitForPath(/^\/game$/, 8000);
    },
  },
  {
    id: "T2-A6-5",
    area: "A6",
    name: "Direct load on deep unknown path /admin/invalid/sub renders 404 without HTTP 404 document error",
    async run(h) {
      await h.goto("/admin/invalid/sub");
      await h.findHeading(/404/);
      await h.waitForText(/Page Not Found/i);
      await h.reload();
      await h.findHeading(/404/);
    },
  },
];
