import 'dotenv/config';
import { getDb } from './db.js';
import { users, gameSessions, gameAnswers, userStats, adminMetrics } from '../drizzle/schema.js';
import { eq, not } from 'drizzle-orm';

async function clear() {
  const db = await getDb();
  if (!db) {
    console.error("No database connection");
    return;
  }
  await db.delete(adminMetrics);
  await db.delete(gameAnswers);
  await db.delete(userStats);
  await db.delete(gameSessions);
  await db.delete(users).where(not(eq(users.role, 'admin')));
  console.log("Fake data cleared!");
  process.exit(0);
}
clear().catch(console.error);
