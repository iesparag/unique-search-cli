#!/usr/bin/env node

// Entry point for unique-search-cli CLI tool
import { parseArgs, getHelpText, getVersionText } from '../lib/config.js';
import { searchFiles } from '../lib/search.js';
import { printResults, printError, printInfo } from '../lib/output.js';

async function main() {
  try {
    const config = parseArgs(process.argv);

    if (config.help) {
      printInfo(getHelpText());
      process.exit(0);
    }
    if (config.version) {
      printInfo(getVersionText());
      process.exit(0);
    }

    // Run search
    let results = await searchFiles(config);

    // Apply uniqueness filter if needed
    if (config.unique) {
      // Unique lines across ALL results (by content). Keep first occurrence per content.
      const seen = new Set();
      results = results.filter(r => {
        if (seen.has(r.line)) return false;
        seen.add(r.line);
        return true;
      });
    }

    printResults(results);

    process.exit(0);
  } catch (err) {
    printError(err && err.message ? err.message : String(err));
    process.exit(1);
  }
}

// Detect if run as main (not via import)
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('/cli.js')) {
  // For correct process exit/status
  Promise.resolve(main());
}
