# Build plan

## Ordered Build Plan

1. Setup project structure and dependencies
   - Scaffold project with bin/, lib/, test/, package.json, README.md, .gitignore.
   - Configure package.json with test script.

2. Implement CLI argument parsing (lib/config.js and bin/cli.js)
   - Parse <query>, optional [path], flags (--unique, --pattern, --ignore-case, --help, --version).
   - Validate inputs (query presence, regex syntax).
   - Provide usage information and version info.

3. Implement filesystem scanning and file reading utilities (lib/utils.js)
   - Recursively list files from directory or handle single file.
   - Read files line-by-line asynchronously.
   - Skip binary or unreadable files gracefully.

4. Implement literal substring search (lib/search.js)
   - Search lines for literal substrings respecting ignore-case flag.
   - Collect matching results with file, line number, content.

5. Implement output formatting and display (lib/output.js and CLI integration)
   - Format results as `file:line: content`.
   - Display "No matches found" when empty.
   - Support error and info messages.

6. Add flags --unique and --ignore-case logic in search
   - Implement uniqueness filtering (deduplicate matched lines globally).
   - Adapt search to ignore case when flag set.

7. Add regex search mode with --pattern flag
   - Validate regex input early.
   - Use regex matching instead of substring.
   - Ensure error safety on invalid expressions.

8. Implement error handling and edge cases
   - Handle empty query, invalid paths, file read errors.
   - Add user-friendly messages with exit codes.
   - Test large files, directory not found, no matches.

9. Testing coverage
   - Unit tests for config parsing, utils (file scanning/reading), search logic.
   - Integration tests simulating CLI runs with sample files.
   - Snapshot tests for CLI output formatting.

10. Documentation
    - Write README with install, usage, examples, options.
    - Add help output text in CLI.

---

## Milestones

- M1: Base CLI structure with arg parsing and usage
- M2: File scanning and reading utilities
- M3: Basic literal search and output display
- M4: Add uniqueness and ignore-case options
- M5: Support regex search
- M6: Robust error handling and edge case coverage
- M7: Complete tests and documentation
