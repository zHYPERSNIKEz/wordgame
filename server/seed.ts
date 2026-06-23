import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { getDb } from './db.js';
import {
  users,
  gameSessions,
  gameAnswers,
  userStats,
  adminMetrics,
} from '../drizzle/schema.js';

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const FIRST_NAMES = ["Ana", "Pedro", "João", "Maria", "Lucas", "Julia", "Matheus", "Laura", "Gabriel", "Beatriz", "Rafael", "Camila", "Bruno", "Leticia", "Gustavo", "Fernanda", "Thiago", "Amanda", "Felipe", "Isabella"];
const LAST_NAMES = ["Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira", "Lima", "Gomes", "Costa", "Ribeiro", "Martins", "Carvalho", "Almeida"];
const SCHOOLS = ["Escola Municipal Paulo Freire", "Colégio Estadual Rui Barbosa", "Instituto Federal", "Colégio Objetivo", "Escola Estadual Machado de Assis", null, null];
const WORDS = [
  { word: "casa", type: "meaning", q: "Qual o significado?", correct: 1, ops: ["Moradia", "Comida", "Transporte", "Animal"] },
  { word: "computador", type: "syllables", q: "Quantas sílabas?", correct: 3, ops: ["2", "3", "4", "5"] },
  { word: "rápido", type: "grammar", q: "Qual a classe gramatical?", correct: 2, ops: ["Substantivo", "Adjetivo", "Verbo", "Advérbio"] },
  { word: "pássaro", type: "accent", q: "A palavra tem acento?", correct: 1, ops: ["Sim, agudo", "Sim, circunflexo", "Não", "Sim, til"] },
];

async function seed() {
  console.log("Conectando ao banco de dados...");
  const db = await getDb();
  if (!db) {
    console.error("Erro ao conectar ao banco");
    process.exit(1);
  }

  console.log("Limpando dados antigos (mantendo admin)...");
  await db.delete(adminMetrics);
  await db.delete(gameAnswers);
  await db.delete(userStats);
  await db.delete(gameSessions);
  await db.delete(users).where(eq(users.role, 'user'));
  // Optional: delete users that are not admin

  console.log("Criando usuários fictícios...");
  const fakeUsers = Array.from({ length: 40 }).map((_, i) => {
    const age = randomInt(7, 45);
    const firstName = randomItem(FIRST_NAMES);
    const lastName = randomItem(LAST_NAMES);
    return {
      openId: `fake_${i}`,
      name: `${firstName} ${lastName}`,
      email: `user${i}@fake.com`,
      age,
      school: randomItem(SCHOOLS),
      role: "user" as const,
      loginMethod: "password",
      createdAt: new Date(Date.now() - randomInt(1, 30) * 86400000),
    };
  });

  await db.insert(users).values(fakeUsers);
  const insertedUsers = await db.select().from(users).where(eq(users.role, 'user'));

  console.log("Criando sessões de jogo e respostas...");
  let sessionIdCounter = 1;
  let answerIdCounter = 1;

  const sessionsToInsert = [];
  const answersToInsert = [];
  const statsMap = new Map();

  for (const user of insertedUsers) {
    const numSessions = randomInt(1, 10);
    
    let uStats = {
      userId: user.id,
      totalSessions: 0,
      totalScore: 0,
      totalAnswers: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      totalPlayTimeSeconds: 0,
    };

    for (let s = 0; s < numSessions; s++) {
      const difficulty = randomItem(["easy", "medium", "hard"]) as any;
      const numAnswers = randomInt(5, 15);
      const isCompleted = true;
      const startedAt = new Date(user.createdAt.getTime() + randomInt(1000, 86400000));
      const durationSeconds = randomInt(30, 300);
      const endedAt = new Date(startedAt.getTime() + durationSeconds * 1000);

      let sessionScore = 0;
      let sessionCorrect = 0;
      let sessionIncorrect = 0;

      for (let a = 0; a < numAnswers; a++) {
        const w = randomItem(WORDS);
        const isCorrect = Math.random() > 0.3; // 70% chance of correct
        const pts = isCorrect ? (difficulty === 'easy' ? 10 : difficulty === 'medium' ? 20 : 30) : 0;
        
        sessionScore += pts;
        if (isCorrect) sessionCorrect++;
        else sessionIncorrect++;

        answersToInsert.push({
          sessionId: sessionIdCounter,
          userId: user.id,
          word: w.word,
          questionType: w.type,
          question: w.q,
          difficulty,
          correctOption: w.correct,
          userSelectedOption: isCorrect ? w.correct : (w.correct === 1 ? 2 : 1),
          isCorrect,
          pointsEarned: pts,
          timeSpentSeconds: randomInt(2, 15),
          createdAt: new Date(startedAt.getTime() + a * 10000),
        });
      }

      sessionsToInsert.push({
        id: sessionIdCounter,
        userId: user.id,
        difficulty,
        startedAt,
        endedAt,
        totalScore: sessionScore,
        totalAnswers: numAnswers,
        correctAnswers: sessionCorrect,
        incorrectAnswers: sessionIncorrect,
        durationSeconds,
        isCompleted,
        createdAt: startedAt,
      });

      uStats.totalSessions++;
      uStats.totalScore += sessionScore;
      uStats.totalAnswers += numAnswers;
      uStats.correctAnswers += sessionCorrect;
      uStats.incorrectAnswers += sessionIncorrect;
      uStats.totalPlayTimeSeconds += durationSeconds;

      sessionIdCounter++;
    }
    statsMap.set(user.id, uStats);
  }

  // Insert in batches if needed, but since it's local we can just insert
  await db.insert(gameSessions).values(sessionsToInsert);
  
  // Insert answers in chunks
  const chunkSize = 1000;
  for (let i = 0; i < answersToInsert.length; i += chunkSize) {
    await db.insert(gameAnswers).values(answersToInsert.slice(i, i + chunkSize));
  }

  console.log("Atualizando estatísticas de usuários...");
  const statsToInsert = Array.from(statsMap.values()).map(s => ({
    ...s,
    averageAccuracy: s.totalAnswers > 0 ? (s.correctAnswers / s.totalAnswers).toString() : "0.00",
    averageSessionDuration: s.totalSessions > 0 ? Math.floor(s.totalPlayTimeSeconds / s.totalSessions) : 0,
  }));
  
  if (statsToInsert.length > 0) {
    await db.insert(userStats).values(statsToInsert);
  }

  console.log("Seed concluído! Os dados falsos foram inseridos no banco.");
  process.exit(0);
}

seed().catch(console.error);
