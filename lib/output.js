// lib/output.js
// Output formatting and result display for unique-search-cli

/**
 * Print search results to stdout in format: file:line: content
 * If results is empty, prints "No matches found".
 * @param {Array<{file: string, lineNumber: number, line: string}>} results
 */
export function printResults(results) {
  if (!results || results.length === 0) {
    console.log('No matches found');
    return;
  }
  for (const match of results) {
    // Print: file:line: content
    const relFile = match.file;
    // Defensive fallback if shape is wrong
    const lineNum = typeof match.lineNumber === 'number' ? match.lineNumber : '?';
    const content = typeof match.line === 'string' ? match.line : '';
    console.log(`${relFile}:${lineNum}: ${content}`);
  }
}

/**
 * Print an error message to stderr
 * @param {string} message
 */
export function printError(message) {
  if (message && typeof message === 'string') {
    process.stderr.write(`Error: ${message}\n`);
  }
}

/**
 * Print an informational message to stdout
 * @param {string} message
 */
export function printInfo(message) {
  if (message && typeof message === 'string') {
    process.stdout.write(`${message}\n`);
  }
}
