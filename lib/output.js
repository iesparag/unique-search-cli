// lib/output.js
// Output formatting and result display for unique-search-cli

/**
 * Print search results to stdout in format: file:line: content
 * If results is empty, prints "No matches found".
 * @param {Array<{file: string, lineNumber: number, line: string}>} results
 */
export function printResults(results) {
  if (!results || results.length === 0) {
    process.stdout.write('\x1b[2mNo matches found\x1b[0m\n');
    return;
  }
  for (const match of results) {
    // Print: file:line: content
    const relFile = match.file;
    // Defensive fallback if shape is wrong
    const lineNum = typeof match.lineNumber === 'number' ? match.lineNumber : '?';
    const content = typeof match.line === 'string' ? match.line : '';
    // Colorize filename and line number
    process.stdout.write(
      `\x1b[36m${relFile}\x1b[0m:\x1b[33m${lineNum}\x1b[0m: ${content}\n`
    );
  }
}

/**
 * Print an error message to stderr, styled red and bold.
 * @param {string} message
 */
export function printError(message) {
  if (message && typeof message === 'string') {
    process.stderr.write(`\x1b[31m\x1b[1mError: ${message}\x1b[0m\n`);
  }
}

/**
 * Print a warning message to stderr, styled yellow.
 * @param {string} message
 */
export function printWarning(message) {
  if (message && typeof message === 'string') {
    process.stderr.write(`\x1b[33mWarning: ${message}\x1b[0m\n`);
  }
}

/**
 * Print an informational message to stdout (gray tone).
 * @param {string} message
 */
export function printInfo(message) {
  if (message && typeof message === 'string') {
    process.stdout.write(`\x1b[2m${message}\x1b[0m\n`);
  }
}
