import fs from "node:fs";
import path from "node:path";
import { createTRPCClient } from "@trpc/client";
import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_ACCOUNTS, resetDemoData } from "../client/src/lib/demoStore";
import { createDemoTrpcLink } from "../client/src/lib/demoTrpcLink";
import type { AppRouter } from "./routers";

describe("Standalone Browser Demo Mode & Vercel Configuration", () => {
  const client = createTRPCClient<AppRouter>({
    links: [createDemoTrpcLink()],
  });

  beforeEach(() => {
    resetDemoData();
  });

  it("should have valid vercel.json configuration for SPA static deployment", () => {
    const vercelPath = path.resolve(process.cwd(), "vercel.json");
    expect(fs.existsSync(vercelPath)).toBe(true);
    const vercelConfig = JSON.parse(fs.readFileSync(vercelPath, "utf8"));
    expect(vercelConfig.buildCommand).toBe("pnpm run build:client");
    expect(vercelConfig.outputDirectory).toBe("dist/public");
    expect(vercelConfig.rewrites?.[0]?.destination).toBe("/index.html");
  });

  it("should support 1-click student login, full game session, scoring, and history", async () => {
    expect(await client.auth.me.query()).toBeNull();

    const student = await client.auth.login.mutate(DEMO_ACCOUNTS.student);
    expect(student.email).toBe("aluno@demo.com");
    expect(student.role).toBe("user");

    const initialHistory = await client.game.getHistory.query();
    expect(initialHistory.length).toBeGreaterThanOrEqual(2);

    const session = await client.game.startSession.mutate({ difficulty: "medium" });
    expect(session.difficulty).toBe("medium");

    const question = await client.game.getQuestion.mutate({
      sessionId: session.sessionId,
    });
    expect(question.options).toHaveLength(4);
    expect(question.correctOption).toBeGreaterThanOrEqual(1);
    expect(question.correctOption).toBeLessThanOrEqual(4);

    const answerResult = await client.game.submitAnswer.mutate({
      sessionId: session.sessionId,
      selectedOption: question.correctOption,
      timeSpentSeconds: 3,
    });
    expect(answerResult.isCorrect).toBe(true);
    expect(answerResult.pointsEarned).toBe(20);
    expect(answerResult.totalScore).toBe(20);

    const endResult = await client.game.endSession.mutate({
      sessionId: session.sessionId,
    });
    expect(endResult.totalScore).toBe(20);

    const details = await client.game.getSessionDetails.query({
      sessionId: session.sessionId,
    });
    expect(details.answers).toHaveLength(1);
    expect(details.answers[0]?.isCorrect).toBe(true);
  });

  it("should support registration with class invite code, teacher class management, and admin promotion", async () => {
    const newStudent = await client.auth.register.mutate({
      name: "Visitante Portfólio",
      email: "visitante@portfolio.dev",
      age: 20,
      school: "Escola Demo Web",
      inviteCode: "PORT6A",
      password: "Password123!",
      passwordConfirm: "Password123!",
    });
    expect(newStudent.email).toBe("visitante@portfolio.dev");
    expect(newStudent.classId).not.toBeNull();

    // Teacher flow
    const teacher = await client.auth.login.mutate(DEMO_ACCOUNTS.moderator);
    expect(teacher.role).toBe("moderator");

    const classes = await client.teacher.getMyClasses.query();
    expect(classes.length).toBeGreaterThanOrEqual(2);

    const port6a = classes.find((c) => c.inviteCode === "PORT6A");
    expect(port6a).toBeDefined();

    const students = await client.teacher.getClassStudents.query({
      classId: port6a!.id,
    });
    expect(students.some((s) => s.email === "visitante@portfolio.dev")).toBe(true);

    const createdClass = await client.teacher.createClass.mutate({
      name: "Gramática Aplicada 2026",
    });
    expect(createdClass.inviteCode).toHaveLength(6);

    // Admin flow
    const admin = await client.auth.login.mutate(DEMO_ACCOUNTS.admin);
    expect(admin.role).toBe("admin");

    const metrics = await client.admin.getMetrics.query();
    expect(metrics.ageGroupMetrics).toHaveLength(5);
    expect(metrics.schoolMetrics.length).toBeGreaterThan(0);
    expect(metrics.scorePerformance).toHaveLength(5);

    await client.admin.promoteToModerator.mutate({ userId: newStudent.id });
    const allUsers = await client.admin.getAllUsers.query();
    expect(allUsers.find((u) => u.id === newStudent.id)?.role).toBe("moderator");
  });
});
