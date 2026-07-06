#!/usr/bin/env node

// Entry point for unique-search-cli CLI tool
import { parseArgs, getHelpText, getVersionText } from '../lib/config.js';

function main() {
  try {
    const config = parseArgs(process.argv);

    if (config.help) {
      console.log(getHelpText());
      process.exit(0);
    }
    if (config.version) {
      console.log(getVersionText());
      process.exit(0);
    }

    // For now, just echo the parsed config (until core is implemented)
    console.log('[unique-search-cli] Parsed config:');
    console.log(config);
    // Next: call search logic (not in scope for this issue)
  } catch (err) {
    // Print error to stderr, show usage
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
