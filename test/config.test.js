// test/config.test.js
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseArgs, getHelpText, getVersionText } from '../lib/config.js';

// Utility to make argv
function mkArgv(str) {
  // E.g. 'myquery --unique path/to/dir'
  const arr = str.split(' ').filter(Boolean);
  return ['node', 'cli.js', ...arr];
}

test('parses required query', () => {
  const cfg = parseArgs(mkArgv('foo'));
  assert.equal(cfg.query, 'foo');
  assert.equal(cfg.path, undefined);
  assert.equal(cfg.unique, false);
  assert.equal(cfg.pattern, false);
  assert.equal(cfg.ignoreCase, false);
});

test('parses query and path', () => {
  const cfg = parseArgs(mkArgv('foo ./bar/baz.txt'));
  assert.equal(cfg.query, 'foo');
  assert.equal(cfg.path, './bar/baz.txt');
});

test('parses flags (all combos)', () => {
  let cfg = parseArgs(mkArgv('findme --unique --pattern --ignore-case'));  
  assert(cfg.unique);
  assert(cfg.pattern);
  assert(cfg.ignoreCase);

  cfg = parseArgs(mkArgv('--ignore-case lookingfor --unique'));
  assert(cfg.unique);
  assert(cfg.ignoreCase);
  assert.equal(cfg.query, 'lookingfor');
});

test('rejects missing query', () => {
  assert.throws(() => parseArgs(mkArgv('')), /Missing required/);
});

test('rejects unknown flag', () => {
  assert.throws(() => parseArgs(mkArgv('foo --bogus')), /Unknown flag/);
});

test('rejects extra positional', () => {
  assert.throws(() => parseArgs(mkArgv('foo bar baz quux')), /Unknown extra argument/);
});

test('validates valid regex when --pattern is set', () => {
  let cfg = parseArgs(mkArgv('^abc[0-9]$ --pattern'));
  assert(cfg.pattern);
  // valid regex
  cfg = parseArgs(mkArgv('--pattern .*[Xyz]'));  // query is .*[Xyz]
  assert(cfg.pattern);
});

test('throws on invalid regex when --pattern', () => {
  assert.throws(() =>
    parseArgs(mkArgv('(*) --pattern')),
    /Invalid regular expression/
  );
});

test('--help and --version accepted without query', () => {
  let cfg = parseArgs(mkArgv('--help'));
  assert(cfg.help);
  cfg = parseArgs(mkArgv('--version'));
  assert(cfg.version);
});

test('getHelpText and getVersionText returns strings', () => {
  assert.equal(typeof getHelpText(), 'string');
  assert(getHelpText().includes('unique-search'));
  assert.equal(typeof getVersionText(), 'string');
  assert(getVersionText().includes('version'));
});
