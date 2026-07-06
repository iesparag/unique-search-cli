// test/search.test.js
import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { searchFiles } from '../lib/search.js';
import { listFiles, readLines } from '../lib/utils.js';

const tmpdir = path.join(process.cwd(), 'searchtest-tmp');

// Helpers for test setup/teardown
import { after } from 'node:test';
after(async () => {
  try { await fs.rm(tmpdir, { recursive: true, force: true }); } catch(e) {}
});

async function setupFiles(tree) {
  // tree: { filename: contentString, ... }
  await fs.rm(tmpdir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(tmpdir, { recursive: true });
  for (const [name, content] of Object.entries(tree)) {
    await fs.writeFile(path.join(tmpdir, name), content);
  }
  return tmpdir;
}

test('finds literal substrings (case sensitive)', async () => {
  const tree = {
    'a.txt': `Hello world\nfoo bar\nWorld hello\nFoO BAR`,
    'b.txt': `something\nanother Foo bar\nfoobar\n`,
  };
  await setupFiles(tree);
  const matches = await searchFiles({
    query: 'foo bar', // case-sensitive, only matches as written
    path: tmpdir,
    ignoreCase: false,
    unique: false
  });
  // Should match a.txt line 2 and b.txt line 2 exactly
  assert.deepEqual(
    matches.map(m => ({
      file: path.basename(m.file),
      lineNumber: m.lineNumber,
      line: m.line
    })),
    [
      { file: 'a.txt', lineNumber: 2, line: 'foo bar' },
      { file: 'b.txt', lineNumber: 2, line: 'another Foo bar' },
    ]
  );
});

test('does not match substrings with different case (case sensitive)', async () => {
  const tree = { 'file.txt': 'foo bar\nFoO BAR\nfoobar\nfoo Barbaz' };
  await setupFiles(tree);
  // 'FoO BAR' is not matched in case sensitive
  const matches = await searchFiles({
    query: 'foo bar',
    path: tmpdir,
    ignoreCase: false,
    unique: false
  });
  assert.deepEqual(
    matches.map(m => m.line),
    ['foo bar']
  );
});

test('finds substrings (case insensitive)', async () => {
  const tree = {
    'x1.txt': 'FOO bar\nfoo BAR\nFoO BaR\n',
    'x2.txt': 'foobar\nfooBar is odd\n',
    'x3.txt': 'no match in this file\n',
  };
  await setupFiles(tree);
  const matches = await searchFiles({
    query: 'foo bar',
    path: tmpdir,
    ignoreCase: true,
    unique: false
  });
  // Should match x1.txt lines 1-3, but not foobar or variations without space
  assert.deepEqual(
    matches.map(m => ({ file: path.basename(m.file), lineNumber: m.lineNumber })),
    [
      { file: 'x1.txt', lineNumber: 1 },
      { file: 'x1.txt', lineNumber: 2 },
      { file: 'x1.txt', lineNumber: 3 },
    ]
  );
});

test('returns line number and content correctly', async () => {
  const tree = {
    'a.log': 'One\nTwo\nThree\nTwo\n',
    'b.dat': 'two\nnot what\n',
  };
  await setupFiles(tree);
  const matches = await searchFiles({ query: 'Two', path: tmpdir, unique: false });
  // a.log lines 2 and 4 are 'Two'
  assert.deepEqual(
    matches.map(m => ({ file: path.basename(m.file), lineNumber: m.lineNumber, line: m.line })),
    [
      { file: 'a.log', lineNumber: 2, line: 'Two' },
      { file: 'a.log', lineNumber: 4, line: 'Two' },
    ]
  );
});

test('returns empty list if no match is found', async () => {
  const tree = {
    'a.txt': 'hello\nworld\nfoo\n',
    'b.txt': 'nothing matches here\n',
  };
  await setupFiles(tree);
  const matches = await searchFiles({ query: 'quux', path: tmpdir, ignoreCase: false, unique: false });
  assert.deepEqual(matches, []);
});

test('returns empty if search string not in any file (case insensitive)', async () => {
  const tree = {
    'abc.txt': 'hello world\nwoot\nfoo',
    'def.txt': 'hELLo \nQuuX not found\n',
  };
  await setupFiles(tree);
  const matches = await searchFiles({ query: 'zebra', path: tmpdir, ignoreCase: true, unique: false });
  assert.deepEqual(matches, []);
});

test('throws on empty query string', async () => {
  const tree = { 'f.txt': 'foo' };
  await setupFiles(tree);
  await assert.rejects(async () => searchFiles({ query: '', path: tmpdir }), /empty query/i);
});

test('handles files with multibyte utf8', async () => {
  const tree = { 'utf.txt': 'ümlaut ÄÖÜ\n日本語テキスト\nhello FOObar' };
  await setupFiles(tree);
  const matches = await searchFiles({ query: '日本', path: tmpdir, ignoreCase: false, unique: false });
  assert.equal(matches.length, 1);
  assert(matches[0].line.includes('日本'));
});

// ----  UNIQUE/IGNORE-CASE DEDUP TESTS ----

test('unique filter removes duplicate lines across files (case-sensitive)', async () => {
  const tree = {
    'a.txt': 'foo\nbar\nfoo\nbar\nbaz\n', // foo (1,3) bar (2,4) baz (5)
    'b.txt': 'FOO\nfoo\nBar\nbar\n', // FOO (1), foo (2), Bar (3), bar (4)
    'c.txt': 'foo\nfoo\nbar\n',
  };
  await setupFiles(tree);
  const matches = await searchFiles({ query: 'foo', path: tmpdir, ignoreCase: false, unique: true });
  /*
    Matched 'foo' (case-sensitive) lines:
      a.txt:1: foo
      a.txt:3: foo
      b.txt:2: foo
      c.txt:1: foo
      c.txt:2: foo
    After --unique (case sensitive):
      Keep first occurrence of each distinct "foo" (lower/upper different): so only one "foo" remains, but not "FOO"
  */
  assert.deepEqual(
    matches.map(m => ({ file: path.basename(m.file), lineNumber: m.lineNumber, line: m.line })),
    [
      { file: 'a.txt', lineNumber: 1, line: 'foo' },
    ]
  );
});

test('unique filter removes duplicate lines across files (case-insensitive)', async () => {
  const tree = {
    'a.txt': 'foo\nbar\nFoo\nfOo\nBAR\n',
    'b.txt': 'FOO\nfoo\nBar\nbar\nBAZ\n',
    'c.txt': 'foo\nfoo\nbar\n',
  };
  await setupFiles(tree);
  // Dedup ignore-case
  const matches = await searchFiles({ query: 'foo', path: tmpdir, ignoreCase: true, unique: true });
  /*
    All lines matching 'foo' ignoring case: (all variations)
    unique (ignore-case): Only one representative for any case variant
    So the *first* matching line (by file and line order) is what should be kept, rest dropped.
  */
  assert.deepEqual(
    matches.map(m => ({ file: path.basename(m.file), lineNumber: m.lineNumber, line: m.line })),
    [
      { file: 'a.txt', lineNumber: 1, line: 'foo' },
    ]
  );
});

test('unique filter: same line content in different files, keep first occurrence', async () => {
  const tree = {
    'f1.txt': 'duplicate line\nunique line\n',
    'f2.txt': 'duplicate line\nunique again\n',
    'f3.txt': 'duplicate line\nunique line\n',
  };
  await setupFiles(tree);
  const matches = await searchFiles({ query: 'duplicate', path: tmpdir, ignoreCase: false, unique: true });
  // Only first occurrence of 'duplicate line' remains
  assert.deepEqual(
    matches.map(m => ({ file: path.basename(m.file), lineNumber: m.lineNumber, line: m.line })),
    [
      { file: 'f1.txt', lineNumber: 1, line: 'duplicate line' }
    ]
  );
});

test('ignore-case matching + unique on similar lines differing only by case', async () => {
  const tree = {
    'f.txt': 'Duplicate\nDUPLICATE\nduplicate\nhello\nHeLLo\n',
    'g.txt': 'duplicate\nHELLO\n',
  };
  await setupFiles(tree);
  // Now, ignoreCase+unique means 'Duplicate', 'DUPLICATE', etc. become one unique "duplicate" (by first occurrence)
  const matches = await searchFiles({ query: 'duplicate', path: tmpdir, ignoreCase: true, unique: true });
  assert.deepEqual(
    matches.map(m => ({ file: path.basename(m.file), lineNumber: m.lineNumber, line: m.line })),
    [
      { file: 'f.txt', lineNumber: 1, line: 'Duplicate' },
    ]
  );

  // Try with query 'hello': Should yield just 'hello' once (first matching 'hello' with any case)
  const matches2 = await searchFiles({ query: 'hello', path: tmpdir, ignoreCase: true, unique: true });
  assert.deepEqual(
    matches2.map(m => m.line),
    ['hello']
  );
});

test('unique filter: disables only when --unique is off', async () => {
  const tree = {
    'f.txt': 'red\nRed\nRED\nred\n',
    'g.txt': 'red\n',
  };
  await setupFiles(tree);
  // --unique, ignoreCase=false: case sensitive, so only keep first 'red', rest are distinct
  const matches = await searchFiles({ query: 'red', path: tmpdir, ignoreCase: false, unique: true });
  assert.deepEqual(
    matches.map(m => m.line), ['red', 'Red', 'RED']); // Only first 'red', first 'Red', first 'RED'
  // --unique, ignoreCase=true: dedup all to first (all are same)
  const matches2 = await searchFiles({ query: 'red', path: tmpdir, ignoreCase: true, unique: true });
  assert.deepEqual(
    matches2.map(m => m.line), ['red']);
  // --unique: false: All occurrences returned
  const matches3 = await searchFiles({ query: 'red', path: tmpdir, ignoreCase: true, unique: false });
  assert.ok(matches3.length > 1);
});

// ----- REGEX SEARCH MODE TESTS -----

test('regex search: matches lines matching regex pattern', async () => {
  const tree = {
    'log1.txt': 'INFO: All good\nERROR: failed to load\nwarn: low disk\nerr: oops!\n',
    'log2.txt': 'error 42\nERROR: user lost\nsome other line\n',
    'misc.txt': 'not relevant\n',
  };
  await setupFiles(tree);
  // Regex for lines starting with ERROR
  const matches = await searchFiles({ query: '^ERROR:', path: tmpdir, ignoreCase: false, unique: false, pattern: true });
  // matches log1.txt line 2, log2.txt line 2
  assert.deepEqual(
    matches.map(m => ({ file: path.basename(m.file), lineNumber: m.lineNumber, line: m.line })),
    [
      { file: 'log1.txt', lineNumber: 2, line: 'ERROR: failed to load' },
      { file: 'log2.txt', lineNumber: 2, line: 'ERROR: user lost' }
    ]
  );
});

test('regex search: matches with ignoreCase flag', async () => {
  const tree = {
    'app.log': 'ERROR: something broke\nerror: minor issue\nWarning: disk\n',
    'app2.log': 'error: all over\nsilent\n',
  };
  await setupFiles(tree);
  // Match regex /error:/i
  const matches = await searchFiles({ query: 'error:', path: tmpdir, ignoreCase: true, unique: false, pattern: true });
  // Matches all "error:" regardless of case
  assert.deepEqual(
    matches.map(m => m.line),
    [
      'ERROR: something broke',
      'error: minor issue',
      'error: all over'
    ]
  );
});

test('regex search: pattern with meta-characters, match numbers', async () => {
  const tree = {
    'data.txt': 'item 42\nitem 97\nitem: 004\nfoo bar\n',
    'x.txt':    'item 5\nsomething else\n',
  };
  await setupFiles(tree);
  // Match lines: /item \d+/
  const matches = await searchFiles({ query: 'item \\d+', path: tmpdir, ignoreCase: false, unique: false, pattern: true });
  // Should match lines with a space and digits
  assert.deepEqual(
    matches.map(m => m.line),
    ['item 42', 'item 97', 'item 5']
  );
});

test('regex search: pattern that matches no lines returns empty array', async () => {
  const tree = { 'a.txt': 'nope\nno match\n' };
  await setupFiles(tree);
  const matches = await searchFiles({ query: '^ERROR:', path: tmpdir, ignoreCase: false, pattern: true, unique: false });
  assert.deepEqual(matches, []);
});

test('throws helpful error for invalid regex search config', async () => {
  const tree = { 'f.txt': 'hello world' };
  await setupFiles(tree);
  // Provide invalid regex pattern
  await assert.rejects(async () => {
    await searchFiles({ query: '(**', path: tmpdir, pattern: true });
  }, /Invalid regular expression/);
});
