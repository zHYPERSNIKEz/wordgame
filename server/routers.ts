import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure, adminProcedure, moderatorProcedure } from "./_core/trpc";
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
  createClass,
  getClassByInviteCode,
  getClassesByTeacherId,
  getClassById,
  getStudentsByClassId,
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
  inviteCode: z.string().optional().nullable(),
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
          inviteCode: input.inviteCode || undefined,
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
        const sessionToken = await sdk.createSessionToken(
          user.openId ?? `email:${user.email ?? user.id}`,
          { name: user.name ?? "" }
        );
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
      .input(
        z
          .object({
            difficulty: z.enum(["easy", "medium", "hard"]).default("easy"),
          })
          .optional()
      )
      .mutation(async ({ ctx, input }) => {
        const difficulty = input?.difficulty ?? "easy";
        const sessionId = await createGameSession(ctx.user.id, difficulty);
        return { sessionId, difficulty };
      }),

    getRandomWord: publicProcedure.query(async () => {
      const q = generateQuestion("easy");
      return {
        word: q.word,
        definition: q.question,
        partOfSpeech: "substantivo",
        example: `Exemplo com a palavra ${q.word}.`,
      };
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
        if (session.isCompleted) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Sessão já encerrada." });
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
          selectedOption: z.number().int().min(1).max(4).optional(),
          word: z.string().optional(),
          definition: z.string().optional(),
          userAnswer: z.string().optional(),
          timeSpentSeconds: z.number().int().min(0).default(0),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const session = await getGameSession(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        if (session.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        if (session.isCompleted) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Sessão já encerrada." });
        }

        let isCorrect = false;
        let pointsEarned = 0;

        if (input.selectedOption !== undefined) {
          // Retrieve the generated question from memory
          const question = activeQuestions.get(input.sessionId);
          if (!question) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhuma pergunta ativa encontrada para esta sessão." });
          }

          // Remove from memory to prevent double-answering
          activeQuestions.delete(input.sessionId);
          isCorrect = input.selectedOption === question.correctOption;
          pointsEarned = isCorrect
            ? getPointsForDifficulty(session.difficulty as "easy" | "medium" | "hard")
            : 0;

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
        } else if (input.word !== undefined) {
          const normalizedUser = (input.userAnswer ?? "").trim().toLowerCase();
          const normalizedWord = input.word.trim().toLowerCase();
          isCorrect = normalizedUser.length > 0 && normalizedUser === normalizedWord;
          pointsEarned = isCorrect
            ? getPointsForDifficulty(session.difficulty as "easy" | "medium" | "hard")
            : 0;

          await createGameAnswer({
            sessionId: input.sessionId,
            userId: ctx.user.id,
            word: input.word,
            questionType: "meaning",
            question: input.definition ?? null,
            difficulty: session.difficulty,
            isCorrect,
            pointsEarned,
            timeSpentSeconds: input.timeSpentSeconds,
          });
        } else {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Nenhuma opção ou resposta informada.",
          });
        }

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
        if (session.isCompleted) {
          return {
            sessionId: input.sessionId,
            score: session.totalScore,
            totalScore: session.totalScore,
            correctAnswers: session.correctAnswers,
            totalAnswers: session.totalAnswers,
            durationSeconds: session.durationSeconds ?? 0,
          };
        }

        const endedAt = new Date();
        const durationSeconds = Math.max(
          0,
          Math.floor((endedAt.getTime() - session.startedAt.getTime()) / 1000)
        );

        activeQuestions.delete(input.sessionId);
        await updateGameSession(input.sessionId, {
          endedAt,
          durationSeconds,
          isCompleted: true,
        });

        // Update user stats (0..100 percentage scale, guarded against 0 totalAnswers)
        const stats = await getUserStats(ctx.user.id);
        const newTotalSessions = (stats?.totalSessions ?? 0) + 1;
        const newTotalAnswers = (stats?.totalAnswers ?? 0) + session.totalAnswers;
        const newCorrectAnswers = (stats?.correctAnswers ?? 0) + session.correctAnswers;
        const newIncorrectAnswers = (stats?.incorrectAnswers ?? 0) + session.incorrectAnswers;
        const newTotalPlayTimeSeconds = (stats?.totalPlayTimeSeconds ?? 0) + durationSeconds;
        const averageAccuracy =
          newTotalAnswers > 0
            ? ((newCorrectAnswers / newTotalAnswers) * 100).toFixed(2)
            : "0.00";

        const newStats = {
          totalSessions: newTotalSessions,
          totalScore: (stats?.totalScore ?? 0) + session.totalScore,
          totalAnswers: newTotalAnswers,
          correctAnswers: newCorrectAnswers,
          incorrectAnswers: newIncorrectAnswers,
          averageAccuracy,
          totalPlayTimeSeconds: newTotalPlayTimeSeconds,
          averageSessionDuration:
            newTotalSessions > 0
              ? Math.floor(newTotalPlayTimeSeconds / newTotalSessions)
              : 0,
        };

        await updateUserStats(ctx.user.id, newStats);

        return {
          sessionId: input.sessionId,
          score: session.totalScore,
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

  user: router({
    updateProfile: protectedProcedure
      .input(z.object({
        name: z.string().min(2).optional(),
        age: z.number().int().min(5).max(120).optional(),
        school: z.string().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Users can only update their own profile because ctx.user.id is used
        await updateUser(ctx.user.id, {
          name: input.name,
          age: input.age,
          school: input.school,
        });
        
        const updatedUser = await getUserById(ctx.user.id);
        if (!updatedUser) throw new TRPCError({ code: "NOT_FOUND" });
        
        return toPublicUser(updatedUser);
      }),
  }),

  teacher: router({
    createClass: moderatorProcedure
      .input(z.object({ name: z.string().min(2) }))
      .mutation(async ({ ctx, input }) => {
        // Generate a random 6-character invite code
        const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        const classId = await createClass({
          name: input.name,
          teacherId: ctx.user.id,
          inviteCode,
        });
        
        return { classId, inviteCode };
      }),

    getMyClasses: moderatorProcedure.query(async ({ ctx }) => {
      return await getClassesByTeacherId(ctx.user.id);
    }),

    getClassStudents: moderatorProcedure
      .input(z.object({ classId: z.number() }))
      .query(async ({ ctx, input }) => {
        const cls = await getClassById(input.classId);
        if (!cls) throw new TRPCError({ code: "NOT_FOUND" });
        if (cls.teacherId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        
        const students = await getStudentsByClassId(input.classId);
        return students.map(toPublicUser);
      }),
  }),

  admin: router({
    getMetrics: moderatorProcedure.query(async () => {
      const ageGroupMetrics = await getAgeGroupMetrics();
      const schoolMetrics = await getSchoolMetrics();
      const scorePerformance = await getScorePerformanceByAge();

      return {
        ageGroupMetrics,
        schoolMetrics,
        scorePerformance,
      };
    }),

    getAllUsers: adminProcedure.query(async () => {
      const { getAllUsers } = await import('./db');
      const allUsers = await getAllUsers();
      return allUsers.map(toPublicUser);
    }),

    promoteToModerator: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        await updateUser(input.userId, { role: "moderator" });
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
