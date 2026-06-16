import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import {
  createGameSession,
  getGameSession,
  updateGameSession,
  getUserGameSessions,
  createGameAnswer,
  getSessionAnswers,
  getUserStats,
  updateUserStats,
  getAgeGroupMetrics,
  getSchoolMetrics,
  getScorePerformanceByAge,
  getUserById,
  updateUser,
  getUserByOpenId,
} from "./db";
import { TRPCError } from "@trpc/server";
import {
  registerUser,
  authenticateUser,
  toPublicUser,
} from "./auth";
import { generateQuestion, getPointsForDifficulty } from "./questionGenerator";
import { COOKIE_NAME } from "../shared/const";
import { sdk } from "./_core/sdk";

// Memory to store the active question for each session to properly validate answers
const activeQuestions = new Map<number, ReturnType<typeof generateQuestion>>();

// Validation schemas
const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  age: z.number().int().min(5, "Age must be at least 5").max(120, "Age must be valid"),
  school: z.string().optional().nullable(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  passwordConfirm: z.string(),
}).refine((data) => data.password === data.passwordConfirm, {
  message: "Passwords don't match",
  path: ["passwordConfirm"],
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),

    register: publicProcedure
      .input(registerSchema)
      .mutation(async ({ input }) => {
        const user = await registerUser({
          email: input.email,
          name: input.name,
          password: input.password,
          age: input.age,
          school: input.school || undefined,
        });

        return toPublicUser(user);
      }),

    login: publicProcedure
      .input(loginSchema)
      .mutation(async ({ input, ctx }) => {
        const user = await authenticateUser(input.email, input.password);
        if (!user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password",
          });
        }

        // Set session cookie
        const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name ?? "" });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, cookieOptions);

        return toPublicUser(user);
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  game: router({
    startSession: protectedProcedure
      .input(z.object({ difficulty: z.enum(["easy", "medium", "hard"]) }))
      .mutation(async ({ ctx, input }) => {
        const sessionId = await createGameSession(ctx.user.id, input.difficulty);
        return { sessionId, difficulty: input.difficulty };
      }),

    getSession: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const session = await getGameSession(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        if (session.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return session;
      }),

    getQuestion: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const session = await getGameSession(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        if (session.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        // Generate a new question based on difficulty
        const question = generateQuestion((session as any).difficulty as "easy" | "medium" | "hard");
        activeQuestions.set(input.sessionId, question);

        return {
          word: question.word,
          question: question.question,
          questionType: question.questionType,
          options: question.options,
          correctOption: question.correctOption,
        };
      }),

    submitAnswer: protectedProcedure
      .input(
        z.object({
          sessionId: z.number(),
          selectedOption: z.number().int().min(1).max(4),
          timeSpentSeconds: z.number().int().min(0),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const session = await getGameSession(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        if (session.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        // Retrieve the generated question from memory
        const question = activeQuestions.get(input.sessionId);
        if (!question) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhuma pergunta ativa encontrada para esta sessão." });
        }
        
        // Remove from memory to prevent double-answering
        activeQuestions.delete(input.sessionId);
        const isCorrect = input.selectedOption === question.correctOption;
        const pointsEarned = isCorrect ? getPointsForDifficulty(session.difficulty as "easy" | "medium" | "hard") : 0;

        // Create answer record
        await createGameAnswer({
          sessionId: input.sessionId,
          userId: ctx.user.id,
          word: question.word,
          questionType: question.questionType,
          question: question.question,
          difficulty: session.difficulty,
          correctOption: question.correctOption,
          option1: question.options[0],
          option2: question.options[1],
          option3: question.options[2],
          option4: question.options[3],
          userSelectedOption: input.selectedOption,
          isCorrect,
          pointsEarned,
          timeSpentSeconds: input.timeSpentSeconds,
        });

        // Update session
        const newTotalAnswers = session.totalAnswers + 1;
        const newCorrectAnswers = isCorrect ? session.correctAnswers + 1 : session.correctAnswers;
        const newTotalScore = session.totalScore + pointsEarned;

        await updateGameSession(input.sessionId, {
          totalAnswers: newTotalAnswers,
          correctAnswers: newCorrectAnswers,
          incorrectAnswers: newTotalAnswers - newCorrectAnswers,
          totalScore: newTotalScore,
        });

        return {
          isCorrect,
          pointsEarned,
          totalScore: newTotalScore,
          accuracy: ((newCorrectAnswers / newTotalAnswers) * 100).toFixed(2),
        };
      }),

    endSession: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const session = await getGameSession(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        if (session.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const endedAt = new Date();
        const durationSeconds = Math.floor(
          (endedAt.getTime() - session.startedAt.getTime()) / 1000
        );

        await updateGameSession(input.sessionId, {
          endedAt,
          durationSeconds,
          isCompleted: true,
        });

        // Update user stats
        const stats = await getUserStats(ctx.user.id);
        const newStats = {
          totalSessions: (stats?.totalSessions ?? 0) + 1,
          totalScore: (stats?.totalScore ?? 0) + session.totalScore,
          averageAccuracy: ((parseFloat(stats?.averageAccuracy ?? "0") + (session.correctAnswers / session.totalAnswers)) / 2).toString(),
          totalPlayTimeSeconds: (stats?.totalPlayTimeSeconds ?? 0) + durationSeconds,
        };

        await updateUserStats(ctx.user.id, newStats);

        return {
          sessionId: input.sessionId,
          totalScore: session.totalScore,
          correctAnswers: session.correctAnswers,
          totalAnswers: session.totalAnswers,
          durationSeconds,
        };
      }),

    getHistory: protectedProcedure.query(async ({ ctx }) => {
      const sessions = await getUserGameSessions(ctx.user.id);
      return sessions.map((session) => ({
        id: session.id,
        totalScore: session.totalScore,
        correctAnswers: session.correctAnswers,
        totalAnswers: session.totalAnswers,
        accuracy: session.totalAnswers > 0 ? ((session.correctAnswers / session.totalAnswers) * 100).toFixed(2) : "0.00",
        durationSeconds: session.durationSeconds,
        difficulty: session.difficulty,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
      }));
    }),

    getSessionDetails: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const session = await getGameSession(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        if (session.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const answers = await getSessionAnswers(input.sessionId);
        return {
          session,
          answers,
        };
      }),
  }),

  admin: router({
    getMetrics: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const ageGroupMetrics = await getAgeGroupMetrics();
      const schoolMetrics = await getSchoolMetrics();
      const scorePerformance = await getScorePerformanceByAge();

      return {
        ageGroupMetrics,
        schoolMetrics,
        scorePerformance,
      };
    }),

    getAllUsers: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // This would need a getAllUsers function in db.ts
      return [];
    }),
  }),
});

export type AppRouter = typeof appRouter;
