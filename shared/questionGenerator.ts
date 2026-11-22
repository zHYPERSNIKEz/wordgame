/**
 * Question Generator for Portuguese Word Game (Browser- & Server-Safe)
 * Generates 5 types of questions about Portuguese words with zero Node-only APIs.
 */

export type QuestionType = "syllables" | "grammar" | "meaning" | "accent" | "gender";
export type Difficulty = "easy" | "medium" | "hard";

export interface Question {
  word: string;
  questionType: QuestionType;
  question: string;
  difficulty: Difficulty;
  correctOption: number;
  options: [string, string, string, string];
}

interface WordEntry {
  word: string;
  syllables: number;
  grammar: string;
  meaning: string;
  accent: string;
  gender: string;
  number: string;
}

// Portuguese grammar classifications
const grammarTypes = [
  "nome",
  "verbo",
  "adjetivo",
  "advérbio",
  "preposição",
  "artigo",
  "pronome",
  "conjunção",
];

// Common Portuguese words with metadata
const wordDatabase: WordEntry[] = [
  { word: "casa", syllables: 2, grammar: "nome", meaning: "edifício para moradia", accent: "primeira", gender: "feminino", number: "singular" },
  { word: "gato", syllables: 2, grammar: "nome", meaning: "animal doméstico felino", accent: "primeira", gender: "masculino", number: "singular" },
  { word: "correndo", syllables: 3, grammar: "verbo", meaning: "em movimento rápido", accent: "segunda", gender: "neutro", number: "singular" },
  { word: "bonito", syllables: 3, grammar: "adjetivo", meaning: "agradável à vista", accent: "segunda", gender: "masculino", number: "singular" },
  { word: "rapidamente", syllables: 4, grammar: "advérbio", meaning: "com rapidez", accent: "terceira", gender: "neutro", number: "singular" },
  { word: "livro", syllables: 2, grammar: "nome", meaning: "conjunto de páginas", accent: "primeira", gender: "masculino", number: "singular" },
  { word: "menina", syllables: 3, grammar: "nome", meaning: "rapariga jovem", accent: "segunda", gender: "feminino", number: "singular" },
  { word: "andar", syllables: 2, grammar: "verbo", meaning: "caminhar", accent: "segunda", gender: "neutro", number: "singular" },
  { word: "grande", syllables: 2, grammar: "adjetivo", meaning: "de tamanho considerável", accent: "primeira", gender: "neutro", number: "singular" },
  { word: "feliz", syllables: 2, grammar: "adjetivo", meaning: "alegre, contente", accent: "segunda", gender: "neutro", number: "singular" },
  { word: "computador", syllables: 4, grammar: "nome", meaning: "máquina eletrônica", accent: "terceira", gender: "masculino", number: "singular" },
  { word: "beleza", syllables: 3, grammar: "nome", meaning: "qualidade de belo", accent: "segunda", gender: "feminino", number: "singular" },
  { word: "música", syllables: 3, grammar: "nome", meaning: "arte dos sons", accent: "primeira", gender: "feminino", number: "singular" },
  { word: "dançar", syllables: 2, grammar: "verbo", meaning: "mover-se ritmicamente", accent: "segunda", gender: "neutro", number: "singular" },
  { word: "inteligente", syllables: 4, grammar: "adjetivo", meaning: "que tem inteligência", accent: "terceira", gender: "neutro", number: "singular" },
  { word: "maçã", syllables: 2, grammar: "nome", meaning: "fruta vermelha", accent: "segunda", gender: "feminino", number: "singular" },
  { word: "carro", syllables: 2, grammar: "nome", meaning: "veículo motorizado", accent: "primeira", gender: "masculino", number: "singular" },
  { word: "pássaro", syllables: 3, grammar: "nome", meaning: "animal alado", accent: "primeira", gender: "masculino", number: "singular" },
  { word: "estudar", syllables: 3, grammar: "verbo", meaning: "aprender", accent: "terceira", gender: "neutro", number: "singular" },
  { word: "escuro", syllables: 3, grammar: "adjetivo", meaning: "sem luz", accent: "segunda", gender: "masculino", number: "singular" },
];

const VOWEL_GLOBAL_REGEX = /[aeiouáéíóúâêôãõà]/gi;
const VOWEL_CHAR_REGEX = /[aeiouáéíóúâêôãõà]/i;
const PRIMARY_ACCENT_REGEX = /[áéíóúâêô]/i;
const SECONDARY_ACCENT_REGEX = /[ãõà]/i;

/**
 * Count syllables in a Portuguese word (simplified)
 */
function countSyllables(word: string): number {
  const vowels = word.match(VOWEL_GLOBAL_REGEX) || [];
  return Math.max(1, vowels.length);
}

/**
 * Get accent position (tônica) in a Portuguese word.
 * Returns "última" | "penúltima" | "antepenúltima" (or "primeira" for single-vowel words).
 */
function getAccentPosition(word: string): "primeira" | "última" | "penúltima" | "antepenúltima" {
  const vowelPositions: number[] = [];
  for (let i = 0; i < word.length; i++) {
    if (VOWEL_CHAR_REGEX.test(word[i])) {
      vowelPositions.push(i);
    }
  }

  if (vowelPositions.length <= 1) return "primeira";

  // Check explicit acute/circumflex accent first, then tilde/grave accent
  let accentedVowelIdx = vowelPositions.findIndex((pos) => PRIMARY_ACCENT_REGEX.test(word[pos]));
  if (accentedVowelIdx === -1) {
    accentedVowelIdx = vowelPositions.findIndex((pos) => SECONDARY_ACCENT_REGEX.test(word[pos]));
  }

  if (accentedVowelIdx !== -1) {
    const fromEnd = vowelPositions.length - 1 - accentedVowelIdx;
    if (fromEnd === 0) return "última";
    if (fromEnd === 1) return "penúltima";
    return "antepenúltima";
  }

  // Unaccented Portuguese multi-syllable words: oxytone endings -> "última", else "penúltima"
  if (/[rlziun]$/i.test(word) || /(?:im|ins|um|uns|om|ons)$/i.test(word)) {
    return "última";
  }
  return "penúltima";
}

/**
 * Build strictly 4 unique options containing `correctAnswer` and return shuffled options + 1-based index
 */
function buildUniqueOptions(
  correctAnswer: string,
  distractors: string[]
): { options: [string, string, string, string]; correctOption: number } {
  const uniqueDistractors = Array.from(
    new Set(distractors.filter((d) => d !== correctAnswer))
  );
  const selectedDistractors = shuffleArray(uniqueDistractors).slice(0, 3);
  const combined = Array.from(new Set([correctAnswer, ...selectedDistractors]));
  const shuffled = shuffleArray(combined).slice(0, 4) as [string, string, string, string];
  const correctOption = shuffled.indexOf(correctAnswer) + 1;
  return { options: shuffled, correctOption };
}

/**
 * Generate syllable question
 */
function generateSyllableQuestion(word: string, difficulty: Difficulty): Question {
  const correctSyllables = countSyllables(word);
  const candidates = new Set<string>();
  candidates.add(String(correctSyllables + 1));
  candidates.add(String(correctSyllables + 2));
  candidates.add(String(correctSyllables > 1 ? correctSyllables - 1 : correctSyllables + 3));

  let extra = correctSyllables + 3;
  while (candidates.size < 3) {
    if (extra !== correctSyllables) {
      candidates.add(String(extra));
    }
    extra++;
  }

  const { options, correctOption } = buildUniqueOptions(
    String(correctSyllables),
    Array.from(candidates)
  );

  return {
    word,
    questionType: "syllables",
    question: `Quantas sílabas tem a palavra "${word}"?`,
    difficulty,
    correctOption,
    options,
  };
}

/**
 * Generate grammar question
 */
function generateGrammarQuestion(word: string, grammar: string, difficulty: Difficulty): Question {
  const { options, correctOption } = buildUniqueOptions(grammar, grammarTypes);

  return {
    word,
    questionType: "grammar",
    question: `Qual é a classe gramatical da palavra "${word}"?`,
    difficulty,
    correctOption,
    options,
  };
}

/**
 * Generate meaning question
 */
function generateMeaningQuestion(word: string, meaning: string, difficulty: Difficulty): Question {
  const distractorMeanings = [
    "qualidade de ser belo",
    "ação de caminhar",
    "máquina eletrônica",
    "conjunto de páginas",
    "animal doméstico",
    "movimento rápido",
    "alegria e contentamento",
  ];

  const { options, correctOption } = buildUniqueOptions(meaning, distractorMeanings);

  return {
    word,
    questionType: "meaning",
    question: `Qual é o significado da palavra "${word}"?`,
    difficulty,
    correctOption,
    options,
  };
}

/**
 * Generate accent question
 */
function generateAccentQuestion(word: string, difficulty: Difficulty): Question {
  const correctAccent = getAccentPosition(word);
  const accentPositions = ["primeira", "penúltima", "antepenúltima", "última"];
  const { options, correctOption } = buildUniqueOptions(correctAccent, accentPositions);

  return {
    word,
    questionType: "accent",
    question: `Qual sílaba é tônica (acentuada) em "${word}"?`,
    difficulty,
    correctOption,
    options,
  };
}

/**
 * Generate gender/number question
 */
function generateGenderQuestion(
  word: string,
  gender: string,
  number: string,
  difficulty: Difficulty
): Question {
  const answer = `${gender} / ${number}`;
  const candidateAnswers = [
    `feminino / ${number}`,
    `masculino / ${number}`,
    `${gender} / plural`,
    `${gender} / singular`,
    "neutro / singular",
    "neutro / plural",
  ];

  const { options, correctOption } = buildUniqueOptions(answer, candidateAnswers);

  return {
    word,
    questionType: "gender",
    question: `Qual é o gênero e número da palavra "${word}"?`,
    difficulty,
    correctOption,
    options,
  };
}

/**
 * Shuffle array randomly
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Get random word from database
 */
function getRandomWord(): WordEntry {
  return wordDatabase[Math.floor(Math.random() * wordDatabase.length)];
}

/**
 * Generate a random question based on difficulty
 */
export function generateQuestion(difficulty: Difficulty): Question {
  const wordData = getRandomWord();
  const questionTypes: QuestionType[] = ["syllables", "grammar", "meaning", "accent", "gender"];
  const questionType = questionTypes[Math.floor(Math.random() * questionTypes.length)];

  switch (questionType) {
    case "syllables":
      return generateSyllableQuestion(wordData.word, difficulty);
    case "grammar":
      return generateGrammarQuestion(wordData.word, wordData.grammar, difficulty);
    case "meaning":
      return generateMeaningQuestion(wordData.word, wordData.meaning, difficulty);
    case "accent":
      return generateAccentQuestion(wordData.word, difficulty);
    case "gender":
      return generateGenderQuestion(wordData.word, wordData.gender, wordData.number, difficulty);
  }
}

/**
 * Get points for a difficulty level
 */
export function calculatePoints(difficulty: Difficulty): number {
  switch (difficulty) {
    case "easy":
      return 10;
    case "medium":
      return 20;
    case "hard":
      return 30;
  }
}

export const getPointsForDifficulty = calculatePoints;
