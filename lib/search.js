// lib/search.js
// Implements literal substring (case-sensitive/insensitive) search logic, uniqueness filtering, and ignore-case
import { listFiles, readLines } from './utils.js';

/**
 * @typedef {object} SearchResult
 * @property {string} file - Full file path
 * @property {number} lineNumber - 1-based line number
 * @property {string} line - Line string (as in file, excluding EOL)
 */

/**
 * Applies uniqueness filtering across all results.
 * If ignoreCase is true, uniqueness is case-insensitive.
 *
 * @param {Array<SearchResult>} matches
 * @param {boolean} ignoreCase
 * @returns {Array<SearchResult>}
 */
function uniqueResults(matches, ignoreCase) {
  const seen = new Set();
  const key = ignoreCase
    ? (line) => line.toLowerCase()
    : (line) => line;
  const out = [];
  for (const m of matches) {
    const uniqStr = key(m.line);
    if (seen.has(uniqStr)) continue;
    seen.add(uniqStr);
    out.push(m);
  }
  return out;
}

/**
 * Main searchFiles function for literal substring search.
 * Expects config object:
 *   {
 *     query: string,
 *     path: string | undefined,
 *     ignoreCase: boolean,
 *     unique: boolean
 *   }
 * Returns: Promise<SearchResult[]>
 *
 * Throws if input is invalid (e.g., missing query)
 */
export async function searchFiles(config) {
  if (!config || typeof config.query !== 'string') {
    throw new Error('searchFiles: config.query string required');
  }
  const {
    query,
    path = process.cwd(),
    ignoreCase = false,
    unique = false
  } = config;
  if (query === '') {
    throw new Error('searchFiles: empty query string');
  }

  const matches = [];

  // Prepare matching function: simple substring match
  let test;
  if (ignoreCase) {
    const q = query.toLowerCase();
    test = (line) => line.toLowerCase().includes(q);
  } else {
    test = (line) => line.includes(query);
  }

  // Get files
  for await (const file of listFiles(path)) {
    let lineNum = 0;
    for await (const line of readLines(file)) {
      lineNum++;
      if (test(line)) {
        matches.push({ file, lineNumber: lineNum, line });
      }
    }
  }

  if (unique) {
    return uniqueResults(matches, ignoreCase);
  }

  return matches;
}
