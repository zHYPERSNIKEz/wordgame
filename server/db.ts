import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  gameSessions,
  gameAnswers,
  userStats,
  adminMetrics,
  InsertGameSession,
  InsertGameAnswer,
  InsertUserStats,
  classes,
  InsertClass,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "passwordHash"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    // Handle numeric fields
    if (user.age !== undefined) {
      values.age = user.age;
      updateSet.age = user.age;
    }

    if (user.school !== undefined) {
      values.school = user.school ?? null;
      updateSet.school = user.school ?? null;
    }

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updateUser(id: number, updates: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users).set(updates).where(eq(users.id, id));
}

// Game session queries
export async function createGameSession(userId: number, difficulty: string = "easy"): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(gameSessions).values({
    userId,
    difficulty: difficulty as any,
    startedAt: new Date(),
    isCompleted: false,
  });

  return result[0].insertId;
}

export async function getGameSession(sessionId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(gameSessions)
    .where(eq(gameSessions.id, sessionId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updateGameSession(
  sessionId: number,
  updates: Partial<InsertGameSession>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(gameSessions)
    .set(updates)
    .where(eq(gameSessions.id, sessionId));
}

export async function getUserGameSessions(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(gameSessions)
    .where(eq(gameSessions.userId, userId))
    .orderBy(gameSessions.startedAt);
}

// Game answer queries
export async function createGameAnswer(
  answer: InsertGameAnswer
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(gameAnswers).values(answer);
  return result[0].insertId;
}

export async function getSessionAnswers(sessionId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(gameAnswers)
    .where(eq(gameAnswers.sessionId, sessionId));
}

// User stats queries
export async function getUserStats(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(userStats)
    .where(eq(userStats.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserStats(
  userId: number,
  stats: Partial<InsertUserStats>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getUserStats(userId);

  if (existing) {
    await db
      .update(userStats)
      .set(stats)
      .where(eq(userStats.userId, userId));
  } else {
    await db.insert(userStats).values({
      userId,
      ...stats,
    });
  }
}

// Admin metrics queries
export async function getAdminMetrics(metricType: string) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(adminMetrics)
    .where(eq(adminMetrics.metricType, metricType))
    .orderBy(adminMetrics.metricValue);
}

// Class & Teacher queries
export async function createClass(cls: InsertClass) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(classes).values(cls);
  return result[0].insertId;
}

export async function getClassByInviteCode(inviteCode: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(classes)
    .where(eq(classes.inviteCode, inviteCode))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getClassesByTeacherId(teacherId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(classes)
    .where(eq(classes.teacherId, teacherId));
}

export async function getClassById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(classes)
    .where(eq(classes.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getStudentsByClassId(classId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(users)
    .where(eq(users.classId, classId));
}

export async function getAgeGroupMetrics() {
  const db = await getDb();
  if (!db) return [];

  // Get age group statistics
  const result = await db.execute(
    `SELECT 
      CASE 
        WHEN age < 13 THEN '5-12'
        WHEN age < 18 THEN '13-17'
        WHEN age < 25 THEN '18-24'
        WHEN age < 35 THEN '25-34'
        ELSE '35+'
      END as ageGroup,
      COUNT(DISTINCT u.id) as userCount,
      COUNT(DISTINCT gs.id) as sessionCount,
      AVG(gs.durationSeconds) as avgDuration,
      AVG(us.averageAccuracy) as avgAccuracy
    FROM users u
    LEFT JOIN game_sessions gs ON u.id = gs.userId
    LEFT JOIN user_stats us ON u.id = us.userId
    GROUP BY ageGroup
    ORDER BY ageGroup`
  );

  return result[0];
}

export async function getSchoolMetrics() {
  const db = await getDb();
  if (!db) return [];

  // Get school statistics
  const result = await db.execute(
    `SELECT 
      u.school,
      COUNT(DISTINCT u.id) as userCount,
      COUNT(DISTINCT gs.id) as sessionCount,
      AVG(gs.durationSeconds) as avgDuration,
      AVG(us.averageAccuracy) as avgAccuracy
    FROM users u
    LEFT JOIN game_sessions gs ON u.id = gs.userId
    LEFT JOIN user_stats us ON u.id = us.userId
    WHERE u.school IS NOT NULL
    GROUP BY u.school
    ORDER BY userCount DESC
    LIMIT 20`
  );

  return result[0];
}

export async function getScorePerformanceByAge() {
  const db = await getDb();
  if (!db) return [];

  // Get score performance by age group
  const result = await db.execute(
    `SELECT 
      CASE 
        WHEN u.age < 13 THEN '5-12'
        WHEN u.age < 18 THEN '13-17'
        WHEN u.age < 25 THEN '18-24'
        WHEN u.age < 35 THEN '25-34'
        ELSE '35+'
      END as ageGroup,
      COUNT(DISTINCT u.id) as userCount,
      AVG(us.totalScore) as avgScore,
      MAX(us.totalScore) as maxScore,
      MIN(us.totalScore) as minScore,
      AVG(us.averageAccuracy) as avgAccuracy
    FROM users u
    LEFT JOIN user_stats us ON u.id = us.userId
    GROUP BY ageGroup
    ORDER BY ageGroup`
  );

  return result[0];
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(users)
    .orderBy(users.createdAt);
}
