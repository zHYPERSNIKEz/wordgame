import { describe, it, expect, beforeEach, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createGameContext(userId: number = 1): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `email:user${userId}@example.com`,
    email: `user${userId}@example.com`,
    name: `User ${userId}`,
    passwordHash: "hashed_password",
    loginMethod: "password",
    role: "user",
    age: 15,
    school: "Test School",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("Game Mechanics", () => {
  it("should start a game session", async () => {
    const { ctx } = createGameContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.game.startSession();

    expect(result).toHaveProperty("sessionId");
    expect(result.sessionId).toBeGreaterThan(0);
  });

  it("should get a random word", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: vi.fn() } as TrpcContext["res"],
    });

    const result = await caller.game.getRandomWord();

    expect(result).toHaveProperty("word");
    expect(result).toHaveProperty("definition");
    expect(result.word).toBeTruthy();
    expect(result.definition).toBeTruthy();
  });

  it("should submit an answer and calculate score", async () => {
    const { ctx } = createGameContext();
    const caller = appRouter.createCaller(ctx);

    // Start a session
    const session = await caller.game.startSession();

    // Get a word (we'll use a known word for testing)
    const word = "casa";

    // Submit correct answer
    const result = await caller.game.submitAnswer({
      sessionId: session.sessionId,
      word,
      definition: "A building for living",
      userAnswer: "casa",
      timeSpentSeconds: 5,
    });

    expect(result.isCorrect).toBe(true);
    expect(result.pointsEarned).toBe(10);
    expect(result.totalScore).toBe(10);
    expect(result.accuracy).toBe("100.00");
  });

  it("should handle incorrect answers", async () => {
    const { ctx } = createGameContext();
    const caller = appRouter.createCaller(ctx);

    // Start a session
    const session = await caller.game.startSession();

    // Submit incorrect answer
    const result = await caller.game.submitAnswer({
      sessionId: session.sessionId,
      word: "casa",
      definition: "A building for living",
      userAnswer: "wrong",
      timeSpentSeconds: 5,
    });

    expect(result.isCorrect).toBe(false);
    expect(result.pointsEarned).toBe(0);
    expect(result.totalScore).toBe(0);
  });

  it("should end a session and update stats", async () => {
    const { ctx } = createGameContext();
    const caller = appRouter.createCaller(ctx);

    // Start a session
    const session = await caller.game.startSession();

    // Submit an answer
    await caller.game.submitAnswer({
      sessionId: session.sessionId,
      word: "casa",
      definition: "A building for living",
      userAnswer: "casa",
      timeSpentSeconds: 5,
    });

    // End session
    const result = await caller.game.endSession({
      sessionId: session.sessionId,
    });

    expect(result).toHaveProperty("sessionId");
    expect(result).toHaveProperty("score");
    expect(result).toHaveProperty("correctAnswers");
    expect(result).toHaveProperty("totalAnswers");
    expect(result).toHaveProperty("durationSeconds");
    expect(result.correctAnswers).toBe(1);
    expect(result.totalAnswers).toBe(1);
  });

  it("should retrieve game history", async () => {
    const { ctx } = createGameContext();
    const caller = appRouter.createCaller(ctx);

    // Start and complete a session
    const session = await caller.game.startSession();
    await caller.game.submitAnswer({
      sessionId: session.sessionId,
      word: "livro",
      definition: "A book",
      userAnswer: "livro",
      timeSpentSeconds: 3,
    });
    await caller.game.endSession({ sessionId: session.sessionId });

    // Get history
    const history = await caller.game.getHistory();

    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThan(0);
    expect(history[0]).toHaveProperty("id");
    expect(history[0]).toHaveProperty("totalScore");
  });

  it("should prevent access to other users' sessions", async () => {
    const { ctx: ctx1 } = createGameContext(1);
    const { ctx: ctx2 } = createGameContext(2);
    const caller1 = appRouter.createCaller(ctx1);
    const caller2 = appRouter.createCaller(ctx2);

    // User 1 starts a session
    const session = await caller1.game.startSession();

    // User 2 tries to access it
    try {
      await caller2.game.submitAnswer({
        sessionId: session.sessionId,
        word: "test",
        definition: "test",
        userAnswer: "test",
        timeSpentSeconds: 1,
      });
      expect.fail("Should have thrown FORBIDDEN error");
    } catch (error: any) {
      expect(error.code).toBe("FORBIDDEN");
    }
  });
});
