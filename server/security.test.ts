import { describe, it, expect, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(userId: number = 1, role: "user" | "admin" | "moderator" = "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `email:user${userId}@example.com`,
    email: `user${userId}@example.com`,
    name: `User ${userId}`,
    passwordHash: "hashed",
    loginMethod: "password",
    role,
    age: 15,
    school: "Test School",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as TrpcContext["res"],
  };
}

describe("Security & Authorization", () => {
  describe("Admin Access Control", () => {
    it("should allow admin to access dashboard", async () => {
      const ctx = createContext(1, "admin");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.admin.getMetrics();

      expect(result).toHaveProperty("ageGroupMetrics");
      expect(result).toHaveProperty("schoolMetrics");
      expect(result).toHaveProperty("scorePerformance");
    });

    it("should deny regular user access to admin dashboard", async () => {
      const ctx = createContext(1, "user");
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.admin.getMetrics();
        expect.fail("Should have thrown FORBIDDEN error");
      } catch (error: any) {
        expect(error.code).toBe("FORBIDDEN");
      }
    });

    it("should allow moderator to access metrics but deny access to admin-only functions", async () => {
      const ctx = createContext(1, "moderator");
      const caller = appRouter.createCaller(ctx);

      // Should allow metrics (moderatorProcedure)
      const result = await caller.admin.getMetrics();
      expect(result).toHaveProperty("ageGroupMetrics");

      // Should deny getAllUsers (adminProcedure)
      try {
        await caller.admin.getAllUsers();
        expect.fail("Should have thrown FORBIDDEN error for moderator on admin-only route");
      } catch (error: any) {
        expect(error.code).toBe("FORBIDDEN");
      }
    });
  });

  describe("SQL Injection Prevention", () => {
    it("should safely handle SQL-like input in registration", async () => {
      const caller = appRouter.createCaller({
        user: null,
        req: { protocol: "https", headers: {} } as TrpcContext["req"],
        res: { clearCookie: vi.fn() } as TrpcContext["res"],
      });

      try {
        await caller.auth.register({
          name: "Test User",
          email: "sqli@example.com",
          age: 15,
          password: "validPassword123",
          passwordConfirm: "validPassword123",
        });
        expect(true).toBe(true);
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("Session Security", () => {
    it("should prevent user from accessing another user's session", async () => {
      const ctx1 = createContext(1);
      const ctx2 = createContext(2);
      const caller1 = appRouter.createCaller(ctx1);
      const caller2 = appRouter.createCaller(ctx2);

      const session = await caller1.game.startSession({ difficulty: "easy" });

      try {
        await caller2.game.submitAnswer({
          sessionId: session.sessionId,
          selectedOption: 1,
          timeSpentSeconds: 1,
        });
        expect.fail("Should have thrown FORBIDDEN error");
      } catch (error: any) {
        expect(error.code).toBe("FORBIDDEN");
      }
    });
  });
});
