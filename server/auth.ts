import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { getUserByOpenId, getUserById, upsertUser, updateUser, getClassByInviteCode } from "./db";
import type { User, UserPublic } from "../drizzle/schema";

const SALT_ROUNDS = 10;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

/**
 * Register a new user with email and password
 */
export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
  age: number;
  school?: string;
  inviteCode?: string;
}): Promise<User> {
  // Validate input
  if (!input.email || !input.password || !input.name) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Email, password, and name are required",
    });
  }

  if (input.password.length < 6) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Password must be at least 6 characters",
    });
  }

  if (input.age < 5 || input.age > 120) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Age must be between 5 and 120",
    });
  }

  // Hash password
  const passwordHash = await hashPassword(input.password);

  // Handle invite code
  let classId: number | null = null;
  if (input.inviteCode) {
    const cls = await getClassByInviteCode(input.inviteCode);
    if (!cls) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid invite code",
      });
    }
    classId = cls.id;
  }

  // Create user with a temporary openId (email-based for password auth)
  const openId = `email:${input.email}`;

  try {
    await upsertUser({
      openId,
      name: input.name,
      email: input.email,
      passwordHash,
      age: input.age,
      school: input.school || null,
      classId,
      loginMethod: "password",
      role: "user",
    });

    const user = await getUserByOpenId(openId);
    if (!user) throw new Error("User creation failed");

    return user;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Duplicate entry")) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Email already registered",
      });
    }
    throw error;
  }
}

/**
 * Authenticate user with email and password
 */
export async function authenticateUser(
  email: string,
  password: string
): Promise<User> {
  if (!email || !password) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Email and password are required",
    });
  }

  const openId = `email:${email}`;
  const user = await getUserByOpenId(openId);

  if (!user || !user.passwordHash) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid email or password",
    });
  }

  const isPasswordValid = await verifyPassword(password, user.passwordHash);

  if (!isPasswordValid) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid email or password",
    });
  }

  // Update last signed in
  await updateUser(user.id, {
    lastSignedIn: new Date(),
  });

  return user;
}

/**
 * Convert user to public profile (without password hash)
 */
export function toPublicUser(user: User): UserPublic {
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}
