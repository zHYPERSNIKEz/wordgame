import type {
  Class,
  GameAnswer,
  GameSession,
  User,
  UserPublic,
} from "../../../drizzle/schema";
import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import {
  generateQuestion,
  getPointsForDifficulty,
  type Difficulty,
  type Question,
} from "@shared/questionGenerator";

export const DEMO_STORAGE_KEY = "wordgame_demo_state_v1";

export const DEMO_ACCOUNTS = {
  student: {
    email: "aluno@demo.com",
    password: "demo123",
    role: "user" as const,
    label: "Aluno Demo",
  },
  moderator: {
    email: "professor@demo.com",
    password: "demo123",
    role: "moderator" as const,
    label: "Professor Demo",
  },
  admin: {
    email: "admin@demo.com",
    password: "demo123",
    role: "admin" as const,
    label: "Admin Demo",
  },
} as const;

export type DemoErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_SERVER_ERROR";

export class DemoStoreError extends Error {
  constructor(
    public readonly code: DemoErrorCode,
    message: string
  ) {
    super(message);
    this.name = "DemoStoreError";
  }
}

interface StoredUser
  extends Omit<User, "createdAt" | "updatedAt" | "lastSignedIn"> {
  createdAt: string;
  updatedAt: string;
  lastSignedIn: string;
}

interface StoredClass extends Omit<Class, "createdAt" | "updatedAt"> {
  createdAt: string;
  updatedAt: string;
}

interface StoredGameSession
  extends Omit<GameSession, "startedAt" | "endedAt" | "createdAt"> {
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
}

interface StoredGameAnswer extends Omit<GameAnswer, "createdAt"> {
  createdAt: string;
}

interface StoredUserStats {
  id: number;
  userId: number;
  totalSessions: number;
  totalScore: number;
  totalAnswers: number;
  correctAnswers: number;
  incorrectAnswers: number;
  averageAccuracy: string; // 0..100 percentage scale
  totalPlayTimeSeconds: number;
  averageSessionDuration: number;
  updatedAt: string;
}

export interface DemoState {
  version: 1;
  currentUserId: number | null;
  nextIds: {
    user: number;
    class: number;
    session: number;
    answer: number;
    stats: number;
  };
  users: StoredUser[];
  classes: StoredClass[];
  gameSessions: StoredGameSession[];
  gameAnswers: StoredGameAnswer[];
  userStats: StoredUserStats[];
  activeQuestions: Record<number, Question>;
}

// In-memory fallback when localStorage is unavailable or restricted
let memoryFallback: DemoState | null = null;

/**
 * Fast synchronous deterministic password hash for browser demo mode.
 * Avoids running expensive synchronous bcrypt across ~38 seeded users on startup.
 */
export function hashDemoPassword(password: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 5381;
  for (let i = 0; i < password.length; i++) {
    const ch = password.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 = (Math.imul(h2, 33) ^ ch) >>> 0;
  }
  return `demo:${(h1 >>> 0).toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SAMPLE_WORDS = [
  {
    word: "casa",
    questionType: "meaning",
    question: 'Qual é o significado da palavra "casa"?',
    options: [
      "edifício para moradia",
      "animal doméstico",
      "ação de caminhar",
      "máquina eletrônica",
    ] as [string, string, string, string],
    correctOption: 1,
  },
  {
    word: "computador",
    questionType: "syllables",
    question: 'Quantas sílabas tem a palavra "computador"?',
    options: ["3", "4", "5", "2"] as [string, string, string, string],
    correctOption: 2,
  },
  {
    word: "música",
    questionType: "accent",
    question: 'Qual sílaba é tônica (acentuada) em "música"?',
    options: [
      "última",
      "penúltima",
      "antepenúltima",
      "primeira",
    ] as [string, string, string, string],
    correctOption: 3,
  },
  {
    word: "bonito",
    questionType: "grammar",
    question: 'Qual é a classe gramatical da palavra "bonito"?',
    options: [
      "nome",
      "adjetivo",
      "verbo",
      "advérbio",
    ] as [string, string, string, string],
    correctOption: 2,
  },
  {
    word: "menina",
    questionType: "gender",
    question: 'Qual é o gênero e número da palavra "menina"?',
    options: [
      "feminino / singular",
      "masculino / singular",
      "neutro / singular",
      "feminino / plural",
    ] as [string, string, string, string],
    correctOption: 1,
  },
  {
    word: "maçã",
    questionType: "syllables",
    question: 'Quantas sílabas tem a palavra "maçã"?',
    options: ["1", "2", "3", "4"] as [string, string, string, string],
    correctOption: 2,
  },
];

const FIRST_NAMES = [
  "Ana",
  "Pedro",
  "João",
  "Maria",
  "Lucas",
  "Júlia",
  "Matheus",
  "Laura",
  "Gabriel",
  "Beatriz",
  "Rafael",
  "Camila",
  "Bruno",
  "Letícia",
  "Gustavo",
  "Fernanda",
  "Thiago",
  "Amanda",
  "Felipe",
  "Isabela",
];

const LAST_NAMES = [
  "Silva",
  "Santos",
  "Oliveira",
  "Souza",
  "Rodrigues",
  "Ferreira",
  "Alves",
  "Pereira",
  "Lima",
  "Gomes",
  "Costa",
  "Ribeiro",
  "Martins",
  "Carvalho",
  "Almeida",
];

const SCHOOLS = [
  "Escola Municipal Paulo Freire",
  "Colégio Estadual Rui Barbosa",
  "Instituto Federal",
  "Colégio Objetivo",
  "Escola Estadual Machado de Assis",
];

const AGE_BRACKET_SAMPLES: Array<{ min: number; max: number }> = [
  { min: 8, max: 12 }, // 5-12
  { min: 13, max: 17 }, // 13-17
  { min: 18, max: 24 }, // 18-24
  { min: 25, max: 34 }, // 25-34
  { min: 35, max: 48 }, // 35+
];

export function createSeedState(): DemoState {
  const rand = mulberry32(20260101);
  const randInt = (min: number, max: number) =>
    Math.floor(rand() * (max - min + 1)) + min;

  // Fixed anchor timestamp for reproducible seed data
  const baseNow = new Date("2026-11-20T14:00:00.000Z").getTime();
  const demoPasswordHash = hashDemoPassword("demo123");

  const classes: StoredClass[] = [
    {
      id: 1,
      name: "Português 6º Ano A",
      teacherId: 2,
      inviteCode: "PORT6A",
      createdAt: new Date(baseNow - 28 * 86400000).toISOString(),
      updatedAt: new Date(baseNow - 28 * 86400000).toISOString(),
    },
    {
      id: 2,
      name: "Literatura Ensino Médio",
      teacherId: 2,
      inviteCode: "LIT202",
      createdAt: new Date(baseNow - 20 * 86400000).toISOString(),
      updatedAt: new Date(baseNow - 20 * 86400000).toISOString(),
    },
  ];

  const users: StoredUser[] = [
    {
      id: 1,
      openId: "email:aluno@demo.com",
      name: "Aluno Demo",
      email: "aluno@demo.com",
      passwordHash: demoPasswordHash,
      loginMethod: "password",
      role: "user",
      age: 14,
      school: SCHOOLS[0],
      classId: 1,
      createdAt: new Date(baseNow - 25 * 86400000).toISOString(),
      updatedAt: new Date(baseNow - 1 * 86400000).toISOString(),
      lastSignedIn: new Date(baseNow - 1 * 86400000).toISOString(),
    },
    {
      id: 2,
      openId: "email:professor@demo.com",
      name: "Prof. Ana Paula",
      email: "professor@demo.com",
      passwordHash: demoPasswordHash,
      loginMethod: "password",
      role: "moderator",
      age: 34,
      school: SCHOOLS[0],
      classId: null,
      createdAt: new Date(baseNow - 30 * 86400000).toISOString(),
      updatedAt: new Date(baseNow - 2 * 86400000).toISOString(),
      lastSignedIn: new Date(baseNow - 2 * 86400000).toISOString(),
    },
    {
      id: 3,
      openId: "email:admin@demo.com",
      name: "Admin Sistema",
      email: "admin@demo.com",
      passwordHash: demoPasswordHash,
      loginMethod: "password",
      role: "admin",
      age: 38,
      school: "Secretaria de Educação",
      classId: null,
      createdAt: new Date(baseNow - 35 * 86400000).toISOString(),
      updatedAt: new Date(baseNow - 1 * 86400000).toISOString(),
      lastSignedIn: new Date(baseNow - 1 * 86400000).toISOString(),
    },
  ];

  // 35 sample students across all 5 age brackets (7 per bracket) and all 5 schools
  let nextUserId = 4;
  for (let i = 0; i < 35; i++) {
    const bracket = AGE_BRACKET_SAMPLES[i % AGE_BRACKET_SAMPLES.length];
    const age = randInt(bracket.min, bracket.max);
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName =
      LAST_NAMES[(i * 3 + Math.floor(i / 5)) % LAST_NAMES.length];
    const school = i >= 32 ? null : SCHOOLS[i % SCHOOLS.length];
    const classId = i < 8 ? 1 : i < 13 ? 2 : null;
    const createdMs = baseNow - randInt(3, 29) * 86400000;
    const email = `estudante${i + 1}@demo.com`;

    users.push({
      id: nextUserId,
      openId: `email:${email}`,
      name: `${firstName} ${lastName}`,
      email,
      passwordHash: demoPasswordHash,
      loginMethod: "password",
      role: "user",
      age,
      school,
      classId,
      createdAt: new Date(createdMs).toISOString(),
      updatedAt: new Date(createdMs + 3600000).toISOString(),
      lastSignedIn: new Date(createdMs + 7200000).toISOString(),
    });
    nextUserId++;
  }

  const gameSessions: StoredGameSession[] = [];
  const gameAnswers: StoredGameAnswer[] = [];
  const userStats: StoredUserStats[] = [];

  let nextSessionId = 1;
  let nextAnswerId = 1;
  let nextStatsId = 1;

  const difficulties: Difficulty[] = ["easy", "medium", "hard"];
  const studentUsers = users.filter((u) => u.role === "user");

  for (const student of studentUsers) {
    const numSessions = student.id === 1 ? 4 : randInt(3, 5);
    let totalScore = 0;
    let totalAnswers = 0;
    let correctAnswers = 0;
    let incorrectAnswers = 0;
    let totalPlayTimeSeconds = 0;

    for (let s = 0; s < numSessions; s++) {
      const difficulty =
        difficulties[(student.id + s) % difficulties.length];
      const numQuestions = randInt(5, 8);
      const startedMs =
        new Date(student.createdAt).getTime() +
        (s + 1) * randInt(3600000, 172800000);
      const durationSeconds = randInt(45, 210);
      const endedMs = startedMs + durationSeconds * 1000;

      let sessionScore = 0;
      let sessionCorrect = 0;
      let sessionIncorrect = 0;

      for (let a = 0; a < numQuestions; a++) {
        const sample =
          SAMPLE_WORDS[(student.id + s + a) % SAMPLE_WORDS.length];
        // ~65% to ~85% realistic accuracy depending on student/difficulty
        const threshold =
          difficulty === "easy" ? 0.8 : difficulty === "medium" ? 0.72 : 0.62;
        const isCorrect = rand() < threshold;
        const selectedOption = isCorrect
          ? sample.correctOption
          : (sample.correctOption % 4) + 1;
        const pointsEarned = isCorrect
          ? getPointsForDifficulty(difficulty)
          : 0;

        sessionScore += pointsEarned;
        if (isCorrect) sessionCorrect++;
        else sessionIncorrect++;

        gameAnswers.push({
          id: nextAnswerId++,
          sessionId: nextSessionId,
          userId: student.id,
          word: sample.word,
          questionType: sample.questionType,
          question: sample.question,
          difficulty,
          correctOption: sample.correctOption,
          option1: sample.options[0],
          option2: sample.options[1],
          option3: sample.options[2],
          option4: sample.options[3],
          userSelectedOption: selectedOption,
          isCorrect,
          pointsEarned,
          timeSpentSeconds: randInt(3, 18),
          createdAt: new Date(startedMs + a * 8000).toISOString(),
        });
      }

      gameSessions.push({
        id: nextSessionId++,
        userId: student.id,
        difficulty,
        startedAt: new Date(startedMs).toISOString(),
        endedAt: new Date(endedMs).toISOString(),
        totalScore: sessionScore,
        totalAnswers: numQuestions,
        correctAnswers: sessionCorrect,
        incorrectAnswers: sessionIncorrect,
        durationSeconds,
        isCompleted: true,
        createdAt: new Date(startedMs).toISOString(),
      });

      totalScore += sessionScore;
      totalAnswers += numQuestions;
      correctAnswers += sessionCorrect;
      incorrectAnswers += sessionIncorrect;
      totalPlayTimeSeconds += durationSeconds;
    }

    const avgAccuracyPct =
      totalAnswers > 0
        ? ((correctAnswers / totalAnswers) * 100).toFixed(2)
        : "0.00";

    userStats.push({
      id: nextStatsId++,
      userId: student.id,
      totalSessions: numSessions,
      totalScore,
      totalAnswers,
      correctAnswers,
      incorrectAnswers,
      averageAccuracy: avgAccuracyPct,
      totalPlayTimeSeconds,
      averageSessionDuration:
        numSessions > 0 ? Math.floor(totalPlayTimeSeconds / numSessions) : 0,
      updatedAt: new Date(baseNow).toISOString(),
    });
  }

  return {
    version: 1,
    currentUserId: null,
    nextIds: {
      user: nextUserId,
      class: classes.length + 1,
      session: nextSessionId,
      answer: nextAnswerId,
      stats: nextStatsId,
    },
    users,
    classes,
    gameSessions,
    gameAnswers,
    userStats,
    activeQuestions: {},
  };
}

function isValidDemoState(value: unknown): value is DemoState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DemoState>;
  return (
    candidate.version === 1 &&
    typeof candidate.nextIds === "object" &&
    candidate.nextIds !== null &&
    Array.isArray(candidate.users) &&
    Array.isArray(candidate.classes) &&
    Array.isArray(candidate.gameSessions) &&
    Array.isArray(candidate.gameAnswers) &&
    Array.isArray(candidate.userStats) &&
    typeof candidate.activeQuestions === "object" &&
    candidate.activeQuestions !== null
  );
}

function persistState(state: DemoState): void {
  memoryFallback = state;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Fallback remains in memoryFallback when localStorage is full or restricted
  }
}

export function loadDemoState(): DemoState {
  if (typeof window === "undefined") {
    if (!memoryFallback) {
      memoryFallback = createSeedState();
    }
    return memoryFallback;
  }

  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isValidDemoState(parsed)) {
        memoryFallback = parsed;
        return parsed;
      }
    }
  } catch {
    // Corrupted JSON or restricted localStorage — recover cleanly below
  }

  const seeded = memoryFallback ?? createSeedState();
  persistState(seeded);
  return seeded;
}

export function resetDemoData(): DemoState {
  const fresh = createSeedState();
  persistState(fresh);
  return fresh;
}

function toUserPublic(u: StoredUser): UserPublic {
  const { passwordHash: _passwordHash, ...rest } = u;
  return {
    ...rest,
    createdAt: new Date(u.createdAt),
    updatedAt: new Date(u.updatedAt),
    lastSignedIn: new Date(u.lastSignedIn),
  };
}

function toClass(c: StoredClass): Class {
  return {
    ...c,
    createdAt: new Date(c.createdAt),
    updatedAt: new Date(c.updatedAt),
  };
}

function toGameSession(s: StoredGameSession): GameSession {
  return {
    ...s,
    startedAt: new Date(s.startedAt),
    endedAt: s.endedAt ? new Date(s.endedAt) : null,
    createdAt: new Date(s.createdAt),
  };
}

function toGameAnswer(a: StoredGameAnswer): GameAnswer {
  return {
    ...a,
    createdAt: new Date(a.createdAt),
  };
}

function getCurrentStoredUser(state: DemoState): StoredUser | null {
  if (state.currentUserId === null) return null;
  return state.users.find((u) => u.id === state.currentUserId) ?? null;
}

function requireAuthUser(state: DemoState): StoredUser {
  const user = getCurrentStoredUser(state);
  if (!user) {
    throw new DemoStoreError("UNAUTHORIZED", UNAUTHED_ERR_MSG);
  }
  return user;
}

function requireAdminUser(state: DemoState): StoredUser {
  const user = getCurrentStoredUser(state);
  if (!user || user.role !== "admin") {
    throw new DemoStoreError("FORBIDDEN", NOT_ADMIN_ERR_MSG);
  }
  return user;
}

function requireModeratorUser(state: DemoState): StoredUser {
  const user = getCurrentStoredUser(state);
  if (!user || (user.role !== "admin" && user.role !== "moderator")) {
    throw new DemoStoreError("FORBIDDEN", NOT_ADMIN_ERR_MSG);
  }
  return user;
}

const AGE_GROUPS = ["5-12", "13-17", "18-24", "25-34", "35+"] as const;

function getAgeBracket(age: number | null): (typeof AGE_GROUPS)[number] {
  if (age === null || age >= 35) return "35+";
  if (age < 13) return "5-12";
  if (age < 18) return "13-17";
  if (age < 25) return "18-24";
  return "25-34";
}

export const demoStore = {
  getMe(): UserPublic | null {
    const state = loadDemoState();
    const user = getCurrentStoredUser(state);
    return user ? toUserPublic(user) : null;
  },

  register(input: {
    name: string;
    email: string;
    age: number;
    school?: string | null;
    inviteCode?: string | null;
    password: string;
    passwordConfirm: string;
  }): UserPublic {
    const state = loadDemoState();
    const normalizedEmail = input.email.trim().toLowerCase();

    if (!input.name || input.name.trim().length < 2) {
      throw new DemoStoreError(
        "BAD_REQUEST",
        "Name must be at least 2 characters"
      );
    }
    if (!input.password || input.password.length < 6) {
      throw new DemoStoreError(
        "BAD_REQUEST",
        "Password must be at least 6 characters"
      );
    }
    if (input.password !== input.passwordConfirm) {
      throw new DemoStoreError("BAD_REQUEST", "Passwords don't match");
    }
    if (!Number.isInteger(input.age) || input.age < 5 || input.age > 120) {
      throw new DemoStoreError(
        "BAD_REQUEST",
        "Age must be between 5 and 120"
      );
    }

    const existing = state.users.find(
      (u) =>
        u.email?.toLowerCase() === normalizedEmail ||
        u.openId?.toLowerCase() === `email:${normalizedEmail}`
    );
    if (existing) {
      throw new DemoStoreError("CONFLICT", "Email already registered");
    }

    let classId: number | null = null;
    const trimmedInvite = input.inviteCode?.trim();
    if (trimmedInvite) {
      const cls = state.classes.find(
        (c) => c.inviteCode.toUpperCase() === trimmedInvite.toUpperCase()
      );
      if (!cls) {
        throw new DemoStoreError("BAD_REQUEST", "Invalid invite code");
      }
      classId = cls.id;
    }

    const nowIso = new Date().toISOString();
    const newUser: StoredUser = {
      id: state.nextIds.user++,
      openId: `email:${normalizedEmail}`,
      name: input.name.trim(),
      email: normalizedEmail,
      passwordHash: hashDemoPassword(input.password),
      loginMethod: "password",
      role: "user",
      age: input.age,
      school: input.school?.trim() ? input.school.trim() : null,
      classId,
      createdAt: nowIso,
      updatedAt: nowIso,
      lastSignedIn: nowIso,
    };

    state.users.push(newUser);
    persistState(state);
    return toUserPublic(newUser);
  },

  login(input: { email: string; password: string }): UserPublic {
    const state = loadDemoState();
    const normalizedEmail = input.email.trim().toLowerCase();

    if (!normalizedEmail || !input.password) {
      throw new DemoStoreError(
        "BAD_REQUEST",
        "Email and password are required"
      );
    }

    const user = state.users.find(
      (u) =>
        u.email?.toLowerCase() === normalizedEmail ||
        u.openId?.toLowerCase() === `email:${normalizedEmail}`
    );

    if (
      !user ||
      !user.passwordHash ||
      user.passwordHash !== hashDemoPassword(input.password)
    ) {
      throw new DemoStoreError("UNAUTHORIZED", "Invalid email or password");
    }

    const nowIso = new Date().toISOString();
    user.lastSignedIn = nowIso;
    user.updatedAt = nowIso;
    state.currentUserId = user.id;
    persistState(state);
    return toUserPublic(user);
  },

  logout(): { success: true } {
    const state = loadDemoState();
    state.currentUserId = null;
    persistState(state);
    return { success: true };
  },

  startSession(input: { difficulty: Difficulty }): {
    sessionId: number;
    difficulty: Difficulty;
  } {
    const state = loadDemoState();
    const user = requireAuthUser(state);
    const nowIso = new Date().toISOString();
    const sessionId = state.nextIds.session++;

    state.gameSessions.push({
      id: sessionId,
      userId: user.id,
      difficulty: input.difficulty,
      startedAt: nowIso,
      endedAt: null,
      totalScore: 0,
      totalAnswers: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      durationSeconds: null,
      isCompleted: false,
      createdAt: nowIso,
    });

    persistState(state);
    return { sessionId, difficulty: input.difficulty };
  },

  getSession(input: { sessionId: number }): GameSession {
    const state = loadDemoState();
    const user = requireAuthUser(state);
    const session = state.gameSessions.find((s) => s.id === input.sessionId);
    if (!session) {
      throw new DemoStoreError("NOT_FOUND", "Session not found");
    }
    if (session.userId !== user.id && user.role !== "admin") {
      throw new DemoStoreError("FORBIDDEN", "Forbidden");
    }
    return toGameSession(session);
  },

  getQuestion(input: { sessionId: number }): {
    word: string;
    question: string;
    questionType: string;
    options: [string, string, string, string];
    correctOption: number;
  } {
    const state = loadDemoState();
    const user = requireAuthUser(state);
    const session = state.gameSessions.find((s) => s.id === input.sessionId);
    if (!session) {
      throw new DemoStoreError("NOT_FOUND", "Session not found");
    }
    if (session.userId !== user.id) {
      throw new DemoStoreError("FORBIDDEN", "Forbidden");
    }
    if (session.isCompleted) {
      throw new DemoStoreError("BAD_REQUEST", "Sessão já encerrada.");
    }

    const question = generateQuestion(session.difficulty);
    state.activeQuestions[input.sessionId] = question;
    persistState(state);

    return {
      word: question.word,
      question: question.question,
      questionType: question.questionType,
      options: question.options,
      correctOption: question.correctOption,
    };
  },

  submitAnswer(input: {
    sessionId: number;
    selectedOption: number;
    timeSpentSeconds: number;
  }): {
    isCorrect: boolean;
    pointsEarned: number;
    totalScore: number;
    accuracy: string;
  } {
    const state = loadDemoState();
    const user = requireAuthUser(state);
    const session = state.gameSessions.find((s) => s.id === input.sessionId);
    if (!session) {
      throw new DemoStoreError("NOT_FOUND", "Session not found");
    }
    if (session.userId !== user.id) {
      throw new DemoStoreError("FORBIDDEN", "Forbidden");
    }
    if (session.isCompleted) {
      throw new DemoStoreError("BAD_REQUEST", "Sessão já encerrada.");
    }

    const question = state.activeQuestions[input.sessionId];
    if (!question) {
      throw new DemoStoreError(
        "BAD_REQUEST",
        "Nenhuma pergunta ativa encontrada para esta sessão."
      );
    }

    delete state.activeQuestions[input.sessionId];

    const isCorrect = input.selectedOption === question.correctOption;
    const pointsEarned = isCorrect
      ? getPointsForDifficulty(session.difficulty)
      : 0;

    state.gameAnswers.push({
      id: state.nextIds.answer++,
      sessionId: input.sessionId,
      userId: user.id,
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
      createdAt: new Date().toISOString(),
    });

    const newTotalAnswers = session.totalAnswers + 1;
    const newCorrectAnswers = isCorrect
      ? session.correctAnswers + 1
      : session.correctAnswers;
    const newTotalScore = session.totalScore + pointsEarned;

    session.totalAnswers = newTotalAnswers;
    session.correctAnswers = newCorrectAnswers;
    session.incorrectAnswers = newTotalAnswers - newCorrectAnswers;
    session.totalScore = newTotalScore;

    persistState(state);
    return {
      isCorrect,
      pointsEarned,
      totalScore: newTotalScore,
      accuracy: ((newCorrectAnswers / newTotalAnswers) * 100).toFixed(2),
    };
  },

  endSession(input: { sessionId: number }): {
    sessionId: number;
    totalScore: number;
    correctAnswers: number;
    totalAnswers: number;
    durationSeconds: number;
  } {
    const state = loadDemoState();
    const user = requireAuthUser(state);
    const session = state.gameSessions.find((s) => s.id === input.sessionId);
    if (!session) {
      throw new DemoStoreError("NOT_FOUND", "Session not found");
    }
    if (session.userId !== user.id) {
      throw new DemoStoreError("FORBIDDEN", "Forbidden");
    }
    if (session.isCompleted) {
      return {
        sessionId: session.id,
        totalScore: session.totalScore,
        correctAnswers: session.correctAnswers,
        totalAnswers: session.totalAnswers,
        durationSeconds: session.durationSeconds ?? 0,
      };
    }

    const endedAt = new Date();
    const durationSeconds = Math.max(
      0,
      Math.floor(
        (endedAt.getTime() - new Date(session.startedAt).getTime()) / 1000
      )
    );

    session.endedAt = endedAt.toISOString();
    session.durationSeconds = durationSeconds;
    session.isCompleted = true;
    delete state.activeQuestions[input.sessionId];

    // Update or create userStats (0..100 percentage scale, guarded against 0 totalAnswers)
    let stats = state.userStats.find((st) => st.userId === user.id);
    if (!stats) {
      stats = {
        id: state.nextIds.stats++,
        userId: user.id,
        totalSessions: 0,
        totalScore: 0,
        totalAnswers: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        averageAccuracy: "0.00",
        totalPlayTimeSeconds: 0,
        averageSessionDuration: 0,
        updatedAt: endedAt.toISOString(),
      };
      state.userStats.push(stats);
    }

    stats.totalSessions += 1;
    stats.totalScore += session.totalScore;
    stats.totalAnswers += session.totalAnswers;
    stats.correctAnswers += session.correctAnswers;
    stats.incorrectAnswers += session.incorrectAnswers;
    stats.totalPlayTimeSeconds += durationSeconds;
    stats.averageSessionDuration =
      stats.totalSessions > 0
        ? Math.floor(stats.totalPlayTimeSeconds / stats.totalSessions)
        : 0;
    stats.averageAccuracy =
      stats.totalAnswers > 0
        ? ((stats.correctAnswers / stats.totalAnswers) * 100).toFixed(2)
        : "0.00";
    stats.updatedAt = endedAt.toISOString();

    persistState(state);
    return {
      sessionId: input.sessionId,
      totalScore: session.totalScore,
      correctAnswers: session.correctAnswers,
      totalAnswers: session.totalAnswers,
      durationSeconds,
    };
  },

  getHistory(): Array<{
    id: number;
    totalScore: number;
    correctAnswers: number;
    totalAnswers: number;
    accuracy: string;
    durationSeconds: number | null;
    difficulty: Difficulty;
    startedAt: Date;
    endedAt: Date | null;
  }> {
    const state = loadDemoState();
    const user = requireAuthUser(state);

    return state.gameSessions
      .filter((s) => s.userId === user.id)
      .sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime() ||
          b.id - a.id
      )
      .map((s) => ({
        id: s.id,
        totalScore: s.totalScore,
        correctAnswers: s.correctAnswers,
        totalAnswers: s.totalAnswers,
        accuracy:
          s.totalAnswers > 0
            ? ((s.correctAnswers / s.totalAnswers) * 100).toFixed(2)
            : "0.00",
        durationSeconds: s.durationSeconds,
        difficulty: s.difficulty,
        startedAt: new Date(s.startedAt),
        endedAt: s.endedAt ? new Date(s.endedAt) : null,
      }));
  },

  getSessionDetails(input: { sessionId: number }): {
    session: GameSession;
    answers: GameAnswer[];
  } {
    const state = loadDemoState();
    const user = requireAuthUser(state);
    const session = state.gameSessions.find((s) => s.id === input.sessionId);
    if (!session) {
      throw new DemoStoreError("NOT_FOUND", "Session not found");
    }
    if (session.userId !== user.id && user.role !== "admin") {
      throw new DemoStoreError("FORBIDDEN", "Forbidden");
    }

    const answers = state.gameAnswers
      .filter((a) => a.sessionId === input.sessionId)
      .map(toGameAnswer);

    return {
      session: toGameSession(session),
      answers,
    };
  },

  updateProfile(input: {
    name?: string;
    age?: number;
    school?: string | null;
  }): UserPublic {
    const state = loadDemoState();
    const user = requireAuthUser(state);

    if (input.name !== undefined) {
      const trimmedName = input.name.trim();
      if (trimmedName.length < 2) {
        throw new DemoStoreError(
          "BAD_REQUEST",
          "Name must be at least 2 characters"
        );
      }
      user.name = trimmedName;
    }
    if (input.age !== undefined) {
      user.age = input.age;
    }
    if (input.school !== undefined) {
      user.school = input.school ? input.school.trim() : null;
    }
    user.updatedAt = new Date().toISOString();

    persistState(state);
    return toUserPublic(user);
  },

  createClass(input: { name: string }): {
    classId: number;
    inviteCode: string;
  } {
    const state = loadDemoState();
    const user = requireModeratorUser(state);
    const trimmedName = input.name.trim();
    if (trimmedName.length < 2) {
      throw new DemoStoreError(
        "BAD_REQUEST",
        "Class name must be at least 2 characters"
      );
    }

    let inviteCode = "";
    do {
      inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    } while (
      inviteCode.length < 6 ||
      state.classes.some((c) => c.inviteCode === inviteCode)
    );

    const nowIso = new Date().toISOString();
    const classId = state.nextIds.class++;
    state.classes.push({
      id: classId,
      name: trimmedName,
      teacherId: user.id,
      inviteCode,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    persistState(state);
    return { classId, inviteCode };
  },

  getMyClasses(): Class[] {
    const state = loadDemoState();
    const user = requireModeratorUser(state);
    return state.classes
      .filter((c) => c.teacherId === user.id)
      .map(toClass);
  },

  getClassStudents(input: { classId: number }): UserPublic[] {
    const state = loadDemoState();
    const user = requireModeratorUser(state);
    const cls = state.classes.find((c) => c.id === input.classId);
    if (!cls) {
      throw new DemoStoreError("NOT_FOUND", "Class not found");
    }
    if (cls.teacherId !== user.id && user.role !== "admin") {
      throw new DemoStoreError("FORBIDDEN", "Forbidden");
    }

    return state.users
      .filter((u) => u.classId === input.classId)
      .map(toUserPublic);
  },

  getMetrics(): {
    ageGroupMetrics: Array<{
      ageGroup: string;
      userCount: number;
      sessionCount: number;
      avgDuration: number | null;
      avgAccuracy: number | null;
    }>;
    schoolMetrics: Array<{
      school: string;
      userCount: number;
      sessionCount: number;
      avgDuration: number | null;
      avgAccuracy: number | null;
    }>;
    scorePerformance: Array<{
      ageGroup: string;
      userCount: number;
      avgScore: number | null;
      maxScore: number | null;
      minScore: number | null;
      avgAccuracy: number | null;
    }>;
  } {
    const state = loadDemoState();
    requireModeratorUser(state);

    const statsByUser = new Map<number, StoredUserStats>();
    for (const st of state.userStats) {
      statsByUser.set(st.userId, st);
    }

    const sessionsByUser = new Map<number, StoredGameSession[]>();
    for (const s of state.gameSessions) {
      const list = sessionsByUser.get(s.userId) ?? [];
      list.push(s);
      sessionsByUser.set(s.userId, list);
    }

    const ageGroupMetrics = AGE_GROUPS.map((ageGroup) => {
      const groupUsers = state.users.filter(
        (u) => getAgeBracket(u.age) === ageGroup
      );
      const groupSessions = groupUsers.flatMap(
        (u) => sessionsByUser.get(u.id) ?? []
      );
      const durations = groupSessions
        .map((s) => s.durationSeconds)
        .filter((d): d is number => d !== null);
      const accuracies = groupUsers
        .map((u) => statsByUser.get(u.id))
        .filter((st): st is StoredUserStats => Boolean(st))
        .map((st) => parseFloat(st.averageAccuracy));

      return {
        ageGroup,
        userCount: groupUsers.length,
        sessionCount: groupSessions.length,
        avgDuration:
          durations.length > 0
            ? durations.reduce((a, b) => a + b, 0) / durations.length
            : null,
        avgAccuracy:
          accuracies.length > 0
            ? Number(
                (
                  accuracies.reduce((a, b) => a + b, 0) / accuracies.length
                ).toFixed(2)
              )
            : null,
      };
    }).filter((m) => m.userCount > 0);

    const usersBySchool = new Map<string, StoredUser[]>();
    for (const u of state.users) {
      if (!u.school) continue;
      const list = usersBySchool.get(u.school) ?? [];
      list.push(u);
      usersBySchool.set(u.school, list);
    }

    const schoolMetrics = Array.from(usersBySchool.entries())
      .map(([school, schoolUsers]) => {
        const schoolSessions = schoolUsers.flatMap(
          (u) => sessionsByUser.get(u.id) ?? []
        );
        const durations = schoolSessions
          .map((s) => s.durationSeconds)
          .filter((d): d is number => d !== null);
        const accuracies = schoolUsers
          .map((u) => statsByUser.get(u.id))
          .filter((st): st is StoredUserStats => Boolean(st))
          .map((st) => parseFloat(st.averageAccuracy));

        return {
          school,
          userCount: schoolUsers.length,
          sessionCount: schoolSessions.length,
          avgDuration:
            durations.length > 0
              ? durations.reduce((a, b) => a + b, 0) / durations.length
              : null,
          avgAccuracy:
            accuracies.length > 0
              ? Number(
                  (
                    accuracies.reduce((a, b) => a + b, 0) / accuracies.length
                  ).toFixed(2)
                )
              : null,
        };
      })
      .sort((a, b) => b.userCount - a.userCount)
      .slice(0, 20);

    const scorePerformance = AGE_GROUPS.map((ageGroup) => {
      const groupUsers = state.users.filter(
        (u) => getAgeBracket(u.age) === ageGroup
      );
      const groupStats = groupUsers
        .map((u) => statsByUser.get(u.id))
        .filter((st): st is StoredUserStats => Boolean(st));
      const scores = groupStats.map((st) => st.totalScore);
      const accuracies = groupStats.map((st) => parseFloat(st.averageAccuracy));

      return {
        ageGroup,
        userCount: groupUsers.length,
        avgScore:
          scores.length > 0
            ? Number(
                (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
              )
            : null,
        maxScore: scores.length > 0 ? Math.max(...scores) : null,
        minScore: scores.length > 0 ? Math.min(...scores) : null,
        avgAccuracy:
          accuracies.length > 0
            ? Number(
                (
                  accuracies.reduce((a, b) => a + b, 0) / accuracies.length
                ).toFixed(2)
              )
            : null,
      };
    }).filter((m) => m.userCount > 0);

    return {
      ageGroupMetrics,
      schoolMetrics,
      scorePerformance,
    };
  },

  getAllUsers(): UserPublic[] {
    const state = loadDemoState();
    requireAdminUser(state);
    return [...state.users]
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      .map(toUserPublic);
  },

  promoteToModerator(input: { userId: number }): { success: true } {
    const state = loadDemoState();
    requireAdminUser(state);
    const target = state.users.find((u) => u.id === input.userId);
    if (!target) {
      throw new DemoStoreError("NOT_FOUND", "User not found");
    }
    target.role = "moderator";
    target.updatedAt = new Date().toISOString();
    persistState(state);
    return { success: true };
  },

  notifyOwner(input: { title: string; content: string }): { success: true } {
    const state = loadDemoState();
    requireAdminUser(state);
    const title = input.title.trim();
    const content = input.content.trim();
    if (!title) {
      throw new DemoStoreError("BAD_REQUEST", "Notification title is required.");
    }
    if (!content) {
      throw new DemoStoreError("BAD_REQUEST", "Notification content is required.");
    }
    if (title.length > 1200) {
      throw new DemoStoreError(
        "BAD_REQUEST",
        "Notification title must be at most 1200 characters."
      );
    }
    if (content.length > 20000) {
      throw new DemoStoreError(
        "BAD_REQUEST",
        "Notification content must be at most 20000 characters."
      );
    }
    return { success: true };
  },
};
