# Architecture

## Components

- CLI entry point (bin/cli.js): parses arguments, invokes search, displays results.
- Config module (lib/config.js): handles CLI parsing, validation, and config object creation.
- Utilities (lib/utils.js): file system scanning, line-by-line reading, pattern preparation.
- Search engine (lib/search.js): performs literal or regex search, line matching, result aggregation.
- Output formatter (lib/output.js): formats and prints matched results or messages.

## Folder tree

```
/unique-search-cli
├── bin/
│   └── cli.js
├── lib/
│   ├── config.js
│   ├── utils.js
│   ├── search.js
│   └── output.js
├── test/
│   ├── config.test.js
│   ├── utils.test.js
│   └── search.test.js
├── package.json
├── README.md
└── .gitignore
```

## Data flow

1. User invokes CLI with <query>, optional path and flags.
2. bin/cli.js uses config.js to parse and validate args.
3. utils.js scans directories/files, reads files line-by-line.
4. search.js applies search depending on config (literal or regex, ignore case).
5. Results collected with file, line number, and line content.
6. If --unique, duplicates removed across all results.
7. output.js formats and prints matches or appropriate messages.
8. Errors handled gracefully with descriptive messages.

## Key decisions

- Node.js chosen for native CLI utility development.
- Streaming file reads to handle large files efficiently.
- Config module isolates CLI parsing for testability and clarity.
- Search supports literal and regex modes to increase usefulness.
- Uniqueness applies across all matched lines, not just within file.
- Tests mock filesystem where needed to avoid real disk IO.
- No external dependencies for minimal footprint and easy install.
- User experience prioritized with helpful error messages and usage info.

