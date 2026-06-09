import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, index } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extended with profile fields for the word game.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  passwordHash: text("passwordHash"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  age: int("age"),
  school: varchar("school", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, (table) => ({
  ageIdx: index("age_idx").on(table.age),
  schoolIdx: index("school_idx").on(table.school),
  emailIdx: index("email_idx").on(table.email),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type UserPublic = Omit<User, 'passwordHash'>;

/**
 * Game sessions table - tracks each user's game session
 */
export const gameSessions = mysqlTable("game_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  difficulty: mysqlEnum("difficulty", ["easy", "medium", "hard"]).default("easy").notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  endedAt: timestamp("endedAt"),
  totalScore: int("totalScore").default(0).notNull(),
  totalAnswers: int("totalAnswers").default(0).notNull(),
  correctAnswers: int("correctAnswers").default(0).notNull(),
  incorrectAnswers: int("incorrectAnswers").default(0).notNull(),
  durationSeconds: int("durationSeconds"), // Calculated when session ends
  isCompleted: boolean("isCompleted").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("user_id_idx").on(table.userId),
  startedAtIdx: index("started_at_idx").on(table.startedAt),
}));

export type GameSession = typeof gameSessions.$inferSelect;
export type InsertGameSession = typeof gameSessions.$inferInsert;

/**
 * Game answers table - tracks individual word answers within a session
 */
export const gameAnswers = mysqlTable("game_answers", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  userId: int("userId").notNull(),
  word: varchar("word", { length: 255 }).notNull(),
  questionType: varchar("questionType", { length: 64 }),
  question: text("question"),
  difficulty: mysqlEnum("difficulty", ["easy", "medium", "hard"]),
  correctOption: int("correctOption"),
  option1: varchar("option1", { length: 255 }),
  option2: varchar("option2", { length: 255 }),
  option3: varchar("option3", { length: 255 }),
  option4: varchar("option4", { length: 255 }),
  userSelectedOption: int("userSelectedOption"),
  isCorrect: boolean("isCorrect").notNull(),
  pointsEarned: int("pointsEarned").default(0).notNull(),
  timeSpentSeconds: int("timeSpentSeconds").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  sessionIdIdx: index("session_id_idx").on(table.sessionId),
  userIdIdx: index("user_id_idx").on(table.userId),
}));

export type GameAnswer = typeof gameAnswers.$inferSelect;
export type InsertGameAnswer = typeof gameAnswers.$inferInsert;

/**
 * User statistics table - cached analytics for dashboard queries
 * Updated after each game session completes
 */
export const userStats = mysqlTable("user_stats", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  totalSessions: int("totalSessions").default(0).notNull(),
  totalScore: int("totalScore").default(0).notNull(),
  totalAnswers: int("totalAnswers").default(0).notNull(),
  correctAnswers: int("correctAnswers").default(0).notNull(),
  incorrectAnswers: int("incorrectAnswers").default(0).notNull(),
  averageAccuracy: decimal("averageAccuracy", { precision: 5, scale: 2 }).default("0.00").notNull(),
  totalPlayTimeSeconds: int("totalPlayTimeSeconds").default(0).notNull(),
  averageSessionDuration: int("averageSessionDuration").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("user_id_idx").on(table.userId),
}));

export type UserStats = typeof userStats.$inferSelect;
export type InsertUserStats = typeof userStats.$inferInsert;

/**
 * Admin metrics table - aggregated data for dashboard
 * Updated periodically to provide quick access to analytics
 */
export const adminMetrics = mysqlTable("admin_metrics", {
  id: int("id").autoincrement().primaryKey(),
  metricType: varchar("metricType", { length: 64 }).notNull(), // 'age_group', 'school', 'session_duration', 'score_performance'
  metricKey: varchar("metricKey", { length: 255 }).notNull(), // age range, school name, etc.
  metricValue: decimal("metricValue", { precision: 12, scale: 2 }).notNull(),
  userCount: int("userCount").default(0).notNull(),
  sessionCount: int("sessionCount").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  metricTypeIdx: index("metric_type_idx").on(table.metricType),
}));

export type AdminMetric = typeof adminMetrics.$inferSelect;
export type InsertAdminMetric = typeof adminMetrics.$inferInsert;