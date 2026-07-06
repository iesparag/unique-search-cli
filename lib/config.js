// lib/config.js
// CLI argument parsing and validation

const PKG_VERSION = '0.1.0'; // Keep in sync with package.json

const HELP_TEXT = `\
unique-search <query> [options] [path]

Options:
  --unique         Filter duplicate lines across all results
  --pattern        Treat <query> as a regular expression
  --ignore-case    Case-insensitive matching
  --help           Show this help message and exit
  --version        Show version and exit

Positional arguments:
  <query>    (required) String or pattern to search for
  [path]     (optional) Directory or file to search (default: current directory)
`;

function isFlag(arg) {
  return arg.startsWith('--');
}

export function getHelpText() {
  return HELP_TEXT.trim();
}

export function getVersionText() {
  return `unique-search version ${PKG_VERSION}`;
}

/**
 * Parses process.argv or similar array and returns a validated config object.
 * Throws on error (invalid syntax, missing arguments, invalid options).
 *
 * @param {string[]} argv - The argv array (e.g., process.argv)
 * @returns {object}      - Parsed config object
 *    {
 *      query: String,
 *      path: String (may be undefined),
 *      unique: Boolean,
 *      pattern: Boolean,
 *      ignoreCase: Boolean,
 *      help: Boolean,
 *      version: Boolean
 *    }
 */
export function parseArgs(argv = process.argv) {
  // First two are node and script
  const [, , ...args] = argv;

  let query = undefined;
  let path = undefined;
  let unique = false;
  let pattern = false;
  let ignoreCase = false;
  let help = false;
  let version = false;
  let extra = [];

  // Positional parsing: all flags (`--foo`) can be in any order.
  // First non-flag is query, next non-flag is path.
  let expecting = 'query'; // 'query' → 'path' → done

  for (let i = 0; i < args.length; ++i) {
    const arg = args[i];

    if (isFlag(arg)) {
      if (arg === '--unique') unique = true;
      else if (arg === '--pattern') pattern = true;
      else if (arg === '--ignore-case') ignoreCase = true;
      else if (arg === '--help') help = true;
      else if (arg === '--version') version = true;
      else {
        // Unknown flag
        throw new Error(`Unknown flag: ${arg}\n\n${HELP_TEXT}`);
      }
    } else if (expecting === 'query') {
      query = arg;
      expecting = 'path';
    } else if (expecting === 'path') {
      path = arg;
      expecting = 'done';
    } else {
      extra.push(arg);
    }
  }

  // If help or version is set, remainder validation is skipped
  if (help || version) {
    return {
      query,
      path,
      unique,
      pattern,
      ignoreCase,
      help,
      version
    };
  }

  // Validate required <query>
  if (!query || query.trim() === '') {
    throw new Error(`Missing required <query> argument.\n\n${HELP_TEXT}`);
  }

  // Extra positional arguments
  if (extra.length > 0) {
    throw new Error(`Unknown extra argument(s): ${extra.join(' ')}\n\n${HELP_TEXT}`);
  }

  // Validate regex if --pattern set
  if (pattern) {
    try {
      // If ignoreCase, supply 'i' flag when compiling
      void new RegExp(query, ignoreCase ? 'i' : undefined);
    } catch (err) {
      throw new Error(`Invalid regular expression given for <query>: ${err.message}\n\n${HELP_TEXT}`);
    }
  }

  return {
    query,
    path,
    unique,
    pattern,
    ignoreCase,
    help,
    version
  };
}
