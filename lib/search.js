// lib/search.js
// Implements literal substring or regex search logic, uniqueness filtering, and ignore-case
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
 * Main searchFiles function for literal substring or regex search.
 * Expects config object:
 *   {
 *     query: string,
 *     path: string | undefined,
 *     ignoreCase: boolean,
 *     unique: boolean,
 *     pattern: boolean,
 *     files: Array<string> (optional: restrict search to these files)
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
    unique = false,
    pattern = false,
    files = undefined // if provided, only these files are scanned (override path)
  } = config;
  if (query === '') {
    throw new Error('searchFiles: empty query string');
  }

  const matches = [];

  // Prepare matching function
  let test;

  if (pattern) {
    // Query is a regex string, compile it with ignoreCase if necessary
    let regex;
    try {
      regex = new RegExp(query, ignoreCase ? 'i' : undefined);
    } catch (err) {
      // Should not happen since config.js already validated, but safeguard
      throw new Error(`Invalid regular expression: ${err.message}`);
    }
    test = (line) => regex.test(line);
  } else {
    // Literal substring match
    if (ignoreCase) {
      const q = query.toLowerCase();
      test = (line) => line.toLowerCase().includes(q);
    } else {
      test = (line) => line.includes(query);
    }
  }

  let targets;
  if (Array.isArray(files) && files.length > 0) {
    targets = files;
  } else {
    // If files is not provided, list files in 'path'
    targets = [];
    for await (const f of listFiles(path)) {
      targets.push(f);
    }
  }
  if (!targets || targets.length === 0) {
    throw new Error('No readable files found for searching.');
  }

  for (const file of targets) {
    let lineNum = 0;
    try {
      for await (const line of readLines(file)) {
        lineNum++;
        if (test(line)) {
          matches.push({ file, lineNumber: lineNum, line });
        }
      }
    } catch (err) {
      // On read failure, skip file; warning will have been printed from outside.
    }
  }

  if (unique) {
    return uniqueResults(matches, ignoreCase);
  }

  return matches;
}
