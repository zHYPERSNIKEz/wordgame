import { TRPCClientError, type TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { z, ZodError } from "zod";
import type { AppRouter } from "../../../server/routers";
import { DemoStoreError, demoStore, type DemoErrorCode } from "./demoStore";

const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    age: z
      .number()
      .int()
      .min(5, "Age must be at least 5")
      .max(120, "Age must be valid"),
    school: z.string().optional().nullable(),
    inviteCode: z.string().optional().nullable(),
    password: z.string().min(6, "Password must be at least 6 characters"),
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Passwords don't match",
    path: ["passwordConfirm"],
  });

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const systemHealthSchema = z.object({
  timestamp: z.number().min(0, "timestamp cannot be negative"),
});

const notifyOwnerSchema = z.object({
  title: z.string().min(1, "title is required"),
  content: z.string().min(1, "content is required"),
});

const startSessionSchema = z.object({
  difficulty: z.enum(["easy", "medium", "hard"]),
});

const sessionIdSchema = z.object({
  sessionId: z.number(),
});

const submitAnswerSchema = z.object({
  sessionId: z.number(),
  selectedOption: z.number().int().min(1).max(4),
  timeSpentSeconds: z.number().int().min(0),
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(2).optional(),
  age: z.number().int().min(5).max(120).optional(),
  school: z.string().nullable().optional(),
});

const createClassSchema = z.object({
  name: z.string().trim().min(2),
});

const classIdSchema = z.object({
  classId: z.number(),
});

const promoteToModeratorSchema = z.object({
  userId: z.number(),
});

const HTTP_STATUS_BY_CODE: Record<DemoErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
};

const JSON_RPC_CODE_BY_CODE: Record<DemoErrorCode, -32600 | -32001 | -32003 | -32004 | -32009 | -32603> = {
  BAD_REQUEST: -32600,
  UNAUTHORIZED: -32001,
  FORBIDDEN: -32003,
  NOT_FOUND: -32004,
  CONFLICT: -32009,
  INTERNAL_SERVER_ERROR: -32603,
};

function toTrpcClientError(
  code: DemoErrorCode,
  message: string,
  path: string
): TRPCClientError<AppRouter> {
  return new TRPCClientError<AppRouter>(message, {
    result: {
      error: {
        code: JSON_RPC_CODE_BY_CODE[code],
        message,
        data: {
          code,
          httpStatus: HTTP_STATUS_BY_CODE[code],
          path,
        },
      },
    },
  });
}

function dispatchDemoProcedure(path: string, input: unknown): unknown {
  switch (path) {
    case "system.health": {
      systemHealthSchema.parse(input);
      return { ok: true };
    }
    case "system.notifyOwner": {
      const parsed = notifyOwnerSchema.parse(input);
      return demoStore.notifyOwner(parsed);
    }
    case "auth.me": {
      return demoStore.getMe();
    }
    case "auth.register": {
      const parsed = registerSchema.parse(input);
      return demoStore.register(parsed);
    }
    case "auth.login": {
      const parsed = loginSchema.parse(input);
      return demoStore.login(parsed);
    }
    case "auth.logout": {
      return demoStore.logout();
    }
    case "game.startSession": {
      const parsed = startSessionSchema.parse(input);
      return demoStore.startSession(parsed);
    }
    case "game.getSession": {
      const parsed = sessionIdSchema.parse(input);
      return demoStore.getSession(parsed);
    }
    case "game.getQuestion": {
      const parsed = sessionIdSchema.parse(input);
      return demoStore.getQuestion(parsed);
    }
    case "game.submitAnswer": {
      const parsed = submitAnswerSchema.parse(input);
      return demoStore.submitAnswer(parsed);
    }
    case "game.endSession": {
      const parsed = sessionIdSchema.parse(input);
      return demoStore.endSession(parsed);
    }
    case "game.getHistory": {
      return demoStore.getHistory();
    }
    case "game.getSessionDetails": {
      const parsed = sessionIdSchema.parse(input);
      return demoStore.getSessionDetails(parsed);
    }
    case "user.updateProfile": {
      const parsed = updateProfileSchema.parse(input);
      return demoStore.updateProfile(parsed);
    }
    case "teacher.createClass": {
      const parsed = createClassSchema.parse(input);
      return demoStore.createClass(parsed);
    }
    case "teacher.getMyClasses": {
      return demoStore.getMyClasses();
    }
    case "teacher.getClassStudents": {
      const parsed = classIdSchema.parse(input);
      return demoStore.getClassStudents(parsed);
    }
    case "admin.getMetrics": {
      return demoStore.getMetrics();
    }
    case "admin.getAllUsers": {
      return demoStore.getAllUsers();
    }
    case "admin.promoteToModerator": {
      const parsed = promoteToModeratorSchema.parse(input);
      return demoStore.promoteToModerator(parsed);
    }
    default: {
      throw new DemoStoreError("NOT_FOUND", `Procedure not found: ${path}`);
    }
  }
}

export function createDemoTrpcLink(): TRPCLink<AppRouter> {
  return () => {
    return ({ op }) => {
      return observable((observer) => {
        let cancelled = false;

        Promise.resolve().then(() => {
          if (cancelled) return;
          try {
            const data = dispatchDemoProcedure(op.path, op.input);
            if (cancelled) return;
            observer.next({ result: { type: "data", data } });
            observer.complete();
          } catch (error) {
            if (cancelled) return;
            if (error instanceof DemoStoreError) {
              observer.error(
                toTrpcClientError(error.code, error.message, op.path)
              );
              return;
            }
            if (error instanceof ZodError) {
              const firstMessage =
                error.issues[0]?.message ?? "Invalid input";
              observer.error(
                toTrpcClientError("BAD_REQUEST", firstMessage, op.path)
              );
              return;
            }
            const message =
              error instanceof Error ? error.message : "Unknown demo error";
            observer.error(
              toTrpcClientError("INTERNAL_SERVER_ERROR", message, op.path)
            );
          }
        });

        return () => {
          cancelled = true;
        };
      });
    };
  };
}
