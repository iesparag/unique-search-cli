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
    ignoreCase: false
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
    ignoreCase: true
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
  const matches = await searchFiles({ query: 'Two', path: tmpdir });
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
  const matches = await searchFiles({ query: 'quux', path: tmpdir, ignoreCase: false });
  assert.deepEqual(matches, []);
});

test('returns empty if search string not in any file (case insensitive)', async () => {
  const tree = {
    'abc.txt': 'hello world\nwoot\nfoo',
    'def.txt': 'hELLo \nQuuX not found\n',
  };
  await setupFiles(tree);
  const matches = await searchFiles({ query: 'zebra', path: tmpdir, ignoreCase: true });
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
  const matches = await searchFiles({ query: '日本', path: tmpdir, ignoreCase: false });
  assert.equal(matches.length, 1);
  assert(matches[0].line.includes('日本'));
});
