import { describe, it, expect, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

// Mock DB functions to avoid needing a real MySQL for this unit test
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db") as any;
  return {
    ...actual,
    getDb: vi.fn(),
    updateUser: vi.fn(),
    createClass: vi.fn().mockResolvedValue(101),
    getClassById: vi.fn().mockImplementation(async (id) => {
      if (id === 101) return { id: 101, name: "Turma Teste", teacherId: 10, inviteCode: "INVITE123" };
      return null;
    }),
    getClassByInviteCode: vi.fn().mockImplementation(async (code) => {
      if (code === "INVITE123") return { id: 101, name: "Turma Teste", teacherId: 10, inviteCode: "INVITE123" };
      return null;
    }),
    getClassesByTeacherId: vi.fn().mockResolvedValue([{ id: 101, name: "Turma Teste", teacherId: 10, inviteCode: "INVITE123" }]),
    getStudentsByClassId: vi.fn().mockResolvedValue([{ id: 20, name: "Aluno Teste", classId: 101, role: "user" }]),
    upsertUser: vi.fn(),
    getUserByOpenId: vi.fn().mockImplementation(async (openId) => {
      return { id: 20, openId, name: "Aluno Teste", classId: 101, role: "user" };
    }),
  };
});

function createMockContext(user: any): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as any,
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
  };
}

describe("Teacher & Student System", () => {
  it("should allow admin to promote a user to moderator", async () => {
    const adminCtx = createMockContext({ id: 1, role: "admin" });
    const caller = appRouter.createCaller(adminCtx);
    
    const result = await caller.admin.promoteToModerator({ userId: 10 });
    expect(result.success).toBe(true);
    expect(db.updateUser).toHaveBeenCalledWith(10, { role: "moderator" });
  });

  it("should allow teacher to create a class", async () => {
    const teacherCtx = createMockContext({ id: 10, role: "moderator" });
    const caller = appRouter.createCaller(teacherCtx);
    
    const result = await caller.teacher.createClass({ name: "Turma 5A" });
    expect(result).toHaveProperty("inviteCode");
    expect(db.createClass).toHaveBeenCalled();
  });

  it("should allow teacher to see their classes", async () => {
    const teacherCtx = createMockContext({ id: 10, role: "moderator" });
    const caller = appRouter.createCaller(teacherCtx);
    
    const classes = await caller.teacher.getMyClasses();
    expect(classes).toHaveLength(1);
    expect(classes[0].name).toBe("Turma Teste");
  });

  it("should allow teacher to see students in their class", async () => {
    const teacherCtx = createMockContext({ id: 10, role: "moderator" });
    const caller = appRouter.createCaller(teacherCtx);
    
    const students = await caller.teacher.getClassStudents({ classId: 101 });
    expect(students).toHaveLength(1);
    expect(students[0].name).toBe("Aluno Teste");
  });

  it("should deny access to class students if teacher is not the owner", async () => {
    const otherTeacherCtx = createMockContext({ id: 11, role: "moderator" });
    const caller = appRouter.createCaller(otherTeacherCtx);
    
    try {
      await caller.teacher.getClassStudents({ classId: 101 });
      expect.fail("Should have thrown FORBIDDEN");
    } catch (error: any) {
      expect(error.code).toBe("FORBIDDEN");
    }
  });

  it("should link student to class during registration with invite code", async () => {
    const publicCtx = createMockContext(null);
    const caller = appRouter.createCaller(publicCtx);
    
    await caller.auth.register({
      name: "Novo Aluno",
      email: "aluno@escola.com",
      age: 10,
      password: "password123",
      passwordConfirm: "password123",
      inviteCode: "INVITE123"
    });
    
    expect(db.getClassByInviteCode).toHaveBeenCalledWith("INVITE123");
    expect(db.upsertUser).toHaveBeenCalledWith(expect.objectContaining({
      classId: 101
    }));
  });
});
