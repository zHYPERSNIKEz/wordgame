import axios from "axios";

const DICTIONARY_API_URL = "https://freedictionaryapi.com/api/v1/entries";

export interface DictionaryEntry {
  word: string;
  definition: string;
  partOfSpeech?: string;
  example?: string;
  synonyms?: string[];
}

/**
 * Fetch a word definition from FreeDictionaryAPI
 */
export async function fetchWordDefinition(word: string): Promise<DictionaryEntry | null> {
  try {
    const response = await axios.get(
      `${DICTIONARY_API_URL}/pt/${encodeURIComponent(word.toLowerCase())}`,
      {
        timeout: 5000,
      }
    );

    if (!response.data || response.data.length === 0) {
      return null;
    }

    const entry = response.data[0];
    if (!entry.entries || entry.entries.length === 0) {
      return null;
    }

    const firstEntry = entry.entries[0];
    const firstSense = firstEntry.senses?.[0];

    if (!firstSense || !firstSense.definition) {
      return null;
    }

    return {
      word: entry.word || word,
      definition: firstSense.definition,
      partOfSpeech: firstEntry.partOfSpeech,
      example: firstSense.examples?.[0],
      synonyms: firstSense.synonyms?.slice(0, 5),
    };
  } catch (error) {
    console.error(`[Dictionary] Error fetching word "${word}":`, error);
    return null;
  }
}

/**
 * Fetch multiple words (for caching/preloading)
 */
export async function fetchMultipleWords(
  words: string[]
): Promise<Map<string, DictionaryEntry>> {
  const results = new Map<string, DictionaryEntry>();

  for (const word of words) {
    const entry = await fetchWordDefinition(word);
    if (entry) {
      results.set(word.toLowerCase(), entry);
    }
    // Rate limiting: small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
}

/**
 * Common Portuguese words for the game (fallback list)
 */
export const COMMON_PORTUGUESE_WORDS = [
  "casa",
  "livro",
  "gato",
  "cão",
  "árvore",
  "flor",
  "água",
  "fogo",
  "terra",
  "céu",
  "sol",
  "lua",
  "estrela",
  "nuvem",
  "chuva",
  "vento",
  "neve",
  "montanha",
  "rio",
  "mar",
  "praia",
  "floresta",
  "deserto",
  "cidade",
  "rua",
  "porta",
  "janela",
  "mesa",
  "cadeira",
  "cama",
  "comida",
  "bebida",
  "pão",
  "carne",
  "peixe",
  "fruta",
  "verdura",
  "leite",
  "queijo",
  "ovo",
  "sal",
  "açúcar",
  "óleo",
  "farinha",
  "pessoa",
  "homem",
  "mulher",
  "criança",
  "bebê",
  "pai",
  "mãe",
  "irmão",
  "irmã",
  "avó",
  "avô",
  "tio",
  "tia",
  "primo",
  "prima",
  "amigo",
  "amiga",
  "professor",
  "professora",
  "médico",
  "médica",
  "enfermeiro",
  "enfermeira",
  "policial",
  "bombeiro",
  "soldado",
  "juiz",
  "advogado",
  "advogada",
  "engenheiro",
  "engenheira",
  "arquiteto",
  "arquiteta",
  "artista",
  "músico",
  "música",
  "pintor",
  "pintura",
  "escultor",
  "escultura",
  "escritor",
  "escritora",
  "poeta",
  "poesia",
  "romance",
  "conto",
  "drama",
  "comédia",
  "tragédia",
  "filme",
  "cinema",
  "teatro",
  "dança",
  "dançarino",
  "dançarina",
  "ator",
  "atriz",
  "cantor",
  "cantora",
  "instrumento",
  "piano",
  "guitarra",
  "violino",
  "flauta",
  "trompeta",
  "tambor",
  "sino",
  "sino",
  "sino",
  "sino",
];
