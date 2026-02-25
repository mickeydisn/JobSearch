// NLP utilities for text processing, keyword extraction, and stemming
import natural from "npm:natural";
import { STOPWORD, SHORT_OK_WORDS } from "../api_sqlite/stopword.ts";
import { stripHtml } from "./html_cleaner.ts";

const tokenizer = new natural.WordTokenizer();

/**
 * Remove accents from text using native JS
 */
export const removeAccents = (text: string): string => {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

/**
 * Apply both English and French stemming
 * Returns the stemmed form (tries English first, then French if unchanged)
 */
export const stemWord = (word: string): string => {
  const englishStemmed = natural.PorterStemmer.stem(word);
  // If English stemming changed the word, use it
  if (englishStemmed !== word) {
    return englishStemmed;
  }
  // Otherwise try French stemming
  return natural.PorterStemmerFr.stem(word);
};

/**
 * Normalize content that could be a string or JSON array
 */
export const normalizeContent = (
  content: string | string[] | null | undefined,
): string => {
  if (!content) return "";
  if (Array.isArray(content)) {
    return content.join(" ");
  }
  if (typeof content === "string") {
    // Check if it's a JSON array string
    if (content.trim().startsWith("[") && content.trim().endsWith("]")) {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          return parsed.join(" ");
        }
      } catch {
        // Not valid JSON, return as-is
      }
    }
    return content;
  }
  return "";
};

/**
 * Extract keywords from job content using natural NLP
 * Returns array of [keyword, frequency] tuples sorted by frequency (descending)
 * Only single-word keywords are returned (no multi-word phrases)
 */
export const extractKeywords = (
  jobText: string | string[] | null | undefined,
  jobHtml: string | null | undefined,
  jobHead: string | string[] | null | undefined,
): [string, number][] => {
  // Concatenate all content sources
  const htmlText = stripHtml(jobHtml);
  const textContent = normalizeContent(jobText);
  const headContent = normalizeContent(jobHead);
  const fullText = `${textContent} ${htmlText} ${headContent}`;

  if (!fullText.trim()) return [];

  // Normalize: lowercase and remove accents
  const normalizedText = removeAccents(fullText.toLowerCase());

  // Tokenize using natural
  const tokens = tokenizer.tokenize(normalizedText) || [];

  // Count frequencies of single words only
  const frequencyMap = new Map<string, number>();

  for (const token of tokens) {
    const normalized = token.toLowerCase().trim();

    // Skip stopwords and empty strings
    if (!normalized || STOPWORD.includes(normalized)) continue;

    // Clean the word
    const cleanWord = normalized.replace(/[^a-z0-9+#]/g, "");

    // Skip short words unless in SHORT_OK_WORDS list
    if (cleanWord.length < 3 && !SHORT_OK_WORDS.has(cleanWord)) continue;

    // Skip purely numeric terms
    if (/^\d+$/.test(cleanWord)) continue;

    frequencyMap.set(cleanWord, (frequencyMap.get(cleanWord) || 0) + 1);
  }

  // Apply English and French stemming and aggregate frequencies
  const stemmedMap = new Map<string, number>();
  for (const [keyword, freq] of frequencyMap.entries()) {
    const stemmed = stemWord(keyword);
    stemmedMap.set(stemmed, (stemmedMap.get(stemmed) || 0) + freq);
  }

  // Convert to array of tuples and sort by frequency (descending)
  const keywords: [string, number][] = Array.from(stemmedMap.entries())
    .sort((a, b) => b[1] - a[1]);

  return keywords;
};
