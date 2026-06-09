/**
 * Question Generator for Portuguese Word Game
 * Generates 5 types of questions about Portuguese words
 */

type QuestionType = "syllables" | "grammar" | "meaning" | "accent" | "gender";
type Difficulty = "easy" | "medium" | "hard";

interface Question {
  word: string;
  questionType: QuestionType;
  question: string;
  difficulty: Difficulty;
  correctOption: number;
  options: [string, string, string, string];
}

// Portuguese grammar classifications
const grammarTypes = ["nome", "verbo", "adjetivo", "advérbio", "preposição", "artigo", "pronome", "conjunção"];

// Common Portuguese words with metadata
const wordDatabase = [
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

/**
 * Count syllables in a Portuguese word (simplified)
 */
function countSyllables(word: string): number {
  const vowels = word.match(/[aeiouáéíóúâêô]/gi) || [];
  return Math.max(1, vowels.length);
}

/**
 * Get accent position (tônica) in a word
 */
function getAccentPosition(word: string): string {
  const vowelPositions = [];
  for (let i = 0; i < word.length; i++) {
    if (/[aeiouáéíóúâêô]/i.test(word[i])) {
      vowelPositions.push(i);
    }
  }

  if (vowelPositions.length === 0) return "primeira";
  const lastVowelPos = vowelPositions[vowelPositions.length - 1];

  if (vowelPositions.length === 1) return "primeira";
  if (lastVowelPos === vowelPositions[vowelPositions.length - 1]) return "última";
  if (lastVowelPos === vowelPositions[vowelPositions.length - 2]) return "penúltima";
  return "antepenúltima";
}

/**
 * Generate syllable question
 */
function generateSyllableQuestion(word: string, difficulty: Difficulty): Question {
  const correctSyllables = countSyllables(word);
  const options: [string, string, string, string] = [
    String(correctSyllables),
    String(correctSyllables + 1),
    String(correctSyllables - 1 || 1),
    String(correctSyllables + 2),
  ];

  const shuffled = shuffleArray([...options]);
  const correctOption = shuffled.indexOf(String(correctSyllables)) + 1;

  return {
    word,
    questionType: "syllables",
    question: `Quantas sílabas tem a palavra "${word}"?`,
    difficulty,
    correctOption,
    options: shuffled as [string, string, string, string],
  };
}

/**
 * Generate grammar question
 */
function generateGrammarQuestion(word: string, grammar: string, difficulty: Difficulty): Question {
  const allGrammarTypes = grammarTypes.filter((g) => g !== grammar);
  const wrongOptions = allGrammarTypes.sort(() => Math.random() - 0.5).slice(0, 3);
  const options: [string, string, string, string] = [grammar, ...wrongOptions] as [string, string, string, string];

  const shuffled = shuffleArray([...options]);
  const correctOption = shuffled.indexOf(grammar) + 1;

  return {
    word,
    questionType: "grammar",
    question: `Qual é a classe gramatical da palavra "${word}"?`,
    difficulty,
    correctOption,
    options: shuffled as [string, string, string, string],
  };
}

/**
 * Generate meaning question
 */
function generateMeaningQuestion(word: string, meaning: string, difficulty: Difficulty): Question {
  const meanings = [
    meaning,
    "qualidade de ser belo",
    "ação de caminhar",
    "máquina eletrônica",
    "conjunto de páginas",
    "animal doméstico",
    "movimento rápido",
    "alegria e contentamento",
  ];

  const wrongMeanings = meanings.filter((m) => m !== meaning).sort(() => Math.random() - 0.5).slice(0, 3);
  const options: [string, string, string, string] = [meaning, ...wrongMeanings] as [string, string, string, string];

  const shuffled = shuffleArray([...options]);
  const correctOption = shuffled.indexOf(meaning) + 1;

  return {
    word,
    questionType: "meaning",
    question: `Qual é o significado da palavra "${word}"?`,
    difficulty,
    correctOption,
    options: shuffled as [string, string, string, string],
  };
}

/**
 * Generate accent question
 */
function generateAccentQuestion(word: string, difficulty: Difficulty): Question {
  const correctAccent = getAccentPosition(word);
  const accentPositions = ["primeira", "segunda", "terceira", "última"];
  const wrongAccents = accentPositions.filter((a) => a !== correctAccent);
  const options: [string, string, string, string] = [correctAccent, ...wrongAccents] as [string, string, string, string];

  const shuffled = shuffleArray([...options]);
  const correctOption = shuffled.indexOf(correctAccent) + 1;

  return {
    word,
    questionType: "accent",
    question: `Qual sílaba é tônica (acentuada) em "${word}"?`,
    difficulty,
    correctOption,
    options: shuffled as [string, string, string, string],
  };
}

/**
 * Generate gender/number question
 */
function generateGenderQuestion(word: string, gender: string, number: string, difficulty: Difficulty): Question {
  const answer = `${gender} / ${number}`;
  const wrongAnswers = [
    `feminino / ${number}`,
    `masculino / ${number}`,
    `${gender} / plural`,
    `${gender} / singular`,
    "neutro / singular",
    "neutro / plural",
  ].filter((a) => a !== answer);

  const selected = wrongAnswers.slice(0, 3);
  const options: [string, string, string, string] = [
    answer,
    selected[0] || "feminino / singular",
    selected[1] || "masculino / singular",
    selected[2] || "neutro / singular",
  ];

  const shuffled = shuffleArray([...options]);
  const correctOption = shuffled.indexOf(answer) + 1;

  return {
    word,
    questionType: "gender",
    question: `Qual é o gênero e número da palavra "${word}"?`,
    difficulty,
    correctOption,
    options: shuffled as [string, string, string, string],
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
function getRandomWord() {
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
export function getPointsForDifficulty(difficulty: Difficulty): number {
  switch (difficulty) {
    case "easy":
      return 10;
    case "medium":
      return 20;
    case "hard":
      return 30;
  }
}
