import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  hashPassword,
  verifyPassword,
  registerUser,
  authenticateUser,
  toPublicUser,
} from "./auth";
import type { User } from "../drizzle/schema";

describe("Authentication", () => {
  describe("Password Hashing", () => {
    it("should hash a password", async () => {
      const password = "testPassword123";
      const hash = await hashPassword(password);

      expect(hash).toBeTruthy();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(20);
    });

    it("should verify a correct password", async () => {
      const password = "testPassword123";
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it("should reject an incorrect password", async () => {
      const password = "testPassword123";
      const wrongPassword = "wrongPassword456";
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(wrongPassword, hash);

      expect(isValid).toBe(false);
    });

    it("should generate different hashes for the same password", async () => {
      const password = "testPassword123";
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
      // But both should verify correctly
      expect(await verifyPassword(password, hash1)).toBe(true);
      expect(await verifyPassword(password, hash2)).toBe(true);
    });
  });

  describe("User Registration", () => {
    it("should reject registration with short password", async () => {
      try {
        await registerUser({
          name: "Test User",
          email: "test@example.com",
          password: "short",
          age: 15,
        });
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).toContain("at least 6 characters");
      }
    });

    it("should reject registration with invalid age", async () => {
      try {
        await registerUser({
          name: "Test User",
          email: "test@example.com",
          password: "validPassword123",
          age: 2,
        });
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).toContain("Age must be");
      }
    });

    it("should reject registration with invalid email", async () => {
      try {
        await registerUser({
          name: "Test User",
          email: "not-an-email",
          password: "validPassword123",
          age: 15,
        });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("User Authentication", () => {
    it("should reject login with missing credentials", async () => {
      try {
        await authenticateUser("", "");
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).toContain("required");
      }
    });

    it("should reject login with non-existent user", async () => {
      try {
        await authenticateUser("nonexistent@example.com", "password");
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.code).toBe("UNAUTHORIZED");
      }
    });
  });

  describe("User Public Profile", () => {
    it("should remove passwordHash from public user", () => {
      const user: User = {
        id: 1,
        openId: "email:test@example.com",
        name: "Test User",
        email: "test@example.com",
        passwordHash: "secret_hash",
        loginMethod: "password",
        role: "user",
        age: 15,
        school: "Test School",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      };

      const publicUser = toPublicUser(user);

      expect(publicUser).not.toHaveProperty("passwordHash");
      expect(publicUser).toHaveProperty("name");
      expect(publicUser).toHaveProperty("email");
      expect(publicUser.email).toBe("test@example.com");
    });
  });
});
