#!/usr/bin/env node

// Entry point for unique-search-cli CLI tool
import { parseArgs, getHelpText, getVersionText } from '../lib/config.js';
import { searchFiles } from '../lib/search.js';
import { printResults, printError, printInfo, printWarning } from '../lib/output.js';
import { validatePathReadable, listFiles, isBinaryFile } from '../lib/utils.js';

async function main() {
  try {
    let config;
    try {
      config = parseArgs(process.argv);
    } catch (err) {
      printError(err.message || String(err));
      process.exit(1);
    }

    if (config.help) {
      printInfo(getHelpText());
      process.exit(0);
    }
    if (config.version) {
      printInfo(getVersionText());
      process.exit(0);
    }

    if (!config.query || config.query.trim() === '') {
      printError('Query string is empty. Please provide a search pattern.');
      printInfo('\n' + getHelpText());
      process.exit(1);
    }

    const searchPath = config.path || process.cwd();
    try {
      await validatePathReadable(searchPath);
    } catch (err) {
      printError(`Target path not found or inaccessible: ${searchPath}\nDetails: ${(err && err.message) ? err.message : err}`);
      process.exit(2);
    }

    // Gather all candidate files, catching unreadable/binary files
    let inputFiles = [];
    let warnings = [];
    let nDirs = 0;
    try {
      for await (const f of listFiles(searchPath, (info) => {
        // info: { path, reason }
        warnings.push(info);
      })) {
        inputFiles.push(f);
      }
    } catch (err) {
      printError(`Failed to scan files: ${(err && err.message) ? err.message : err}`);
      process.exit(2);
    }
    if (inputFiles.length === 0 && warnings.length === 0) {
      // Might have searched an empty dir
      try {
        const stat = await import('node:fs/promises').then(fs => fs.stat(searchPath));
        nDirs = stat.isDirectory() ? 1 : 0;
      } catch {}
    }

    for (const w of warnings) {
      if (w && w.path && w.reason) {
        printWarning(w.reason + ': ' + w.path);
      }
    }
    if (inputFiles.length === 0) {
      printInfo('No readable text files to search.' + (warnings.length > 0 ? '' : (nDirs === 1 ? ' (directory empty)' : '')));
      process.exit(0);
    }

    let results;
    try {
      results = await searchFiles({ ...config, files: inputFiles });
    } catch (err) {
      printError(err && err.message ? err.message : String(err));
      process.exit(1);
    }

    printResults(results);
    process.exit(0);
  } catch (err) {
    // Catch-all error handler
    printError('An unexpected error occurred. ' + (err && err.message ? err.message : err));
    process.exit(99);
  }
}

// Detect if run as main (not via import)
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('/cli.js')) {
  // For correct process exit/status
  Promise.resolve(main());
}
