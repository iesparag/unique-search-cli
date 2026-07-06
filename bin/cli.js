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

    // Run search (handles --unique and --ignore-case inside searchFiles now)
    let results = await searchFiles(config);

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
