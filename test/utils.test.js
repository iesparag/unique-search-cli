// test/utils.test.js
// Utilities tests for listFiles and readLines
import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { listFiles, readLines } from '../lib/utils.js';
import { after } from 'node:test';

// In-memory mockfs isn't used, instead use tmp dirs
const tmpdir = path.join(process.cwd(), 'testutils-tmp');

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

// Helper: write tree
const defaultTestTree = {
  "top.txt": "hello 1\nhi again\nEND\n",
  "dir1": {
    "a.txt": "alpha\nbeta\ngamma\n",
    "sub": { "b.txt": "bbb1\nbbb2\n" }
  },
  "dir2": {
    "c.txt": "CCC\nDDD\nEEE\n",
    "bin.bin": Buffer.from([0, 1, 2, 3, 4, 0xff])
  },
  // unreadable file is tested by chmod later
};

async function createTree(root, tree) {
  for (const [name, val] of Object.entries(tree)) {
    const abs = path.join(root, name);
    if (typeof val === 'string' || Buffer.isBuffer(val)) {
      await fs.writeFile(abs, val);
    } else if (typeof val === 'object') {
      await fs.mkdir(abs, { recursive: true });
      await createTree(abs, val);
    }
  }
}

async function cleanupTmp() {
  try { await fs.rm(tmpdir, { recursive: true, force: true }); } catch {} 
  await fs.mkdir(tmpdir, { recursive: true });
}

after(async () => {
  try { await fs.rm(tmpdir, { recursive: true, force: true }); } catch(e) {}
});

test('listFiles returns all text files recursively, skips binary & unreadable', async () => {
  await cleanupTmp();
  await createTree(tmpdir, defaultTestTree);
  // Add an unreadable file
  const secretPath = path.join(tmpdir, 'dir2', 'secret.txt');
  await fs.writeFile(secretPath, 'should not be listed');
  await fs.chmod(secretPath, 0o000);

  const found = [];
  for await (const f of listFiles(tmpdir)) {
    found.push(path.relative(tmpdir, f));
  }
  // Restore permissions so cleanup doesn't error
  await fs.chmod(secretPath, 0o644);

  assert(found.includes('top.txt'));
  assert(found.includes(path.join('dir1', 'a.txt')));
  assert(found.includes(path.join('dir1', 'sub', 'b.txt')));
  assert(found.includes(path.join('dir2', 'c.txt')));
  assert(!found.includes(path.join('dir2', 'bin.bin'))); // binary
  assert(!found.includes(path.join('dir2', 'secret.txt'))); // unreadable
  assert.equal(found.length, 4); // 4 good text files
});

test('listFiles yields just file itself if given a file', async () => {
  await cleanupTmp();
  await createTree(tmpdir, defaultTestTree);
  const onePath = path.join(tmpdir, 'top.txt');
  const files = [];
  for await (const f of listFiles(onePath)) {
    files.push(f);
  }
  assert.deepEqual(files, [onePath]);
});

test('listFiles skips missing path, empty yields nothing', async () => {
  await cleanupTmp();
  const files = [];
  for await (const f of listFiles(path.join(tmpdir, 'no-such-path'))) {
    files.push(f);
  }
  assert.deepEqual(files, []);
});

test('readLines yields all lines of a file', async () => {
  await cleanupTmp();
  const file = path.join(tmpdir, 'foo.txt');
  const lines = [
    'line one',
    '',
    'three',
    'four five',
    '',
    'end'
  ];
  await fs.writeFile(file, lines.join('\n'));
  const got = [];
  for await (const line of readLines(file)) {
    got.push(line);
  }
  assert.deepEqual(got, lines);
});

test('readLines yields lines from large files', async () => {
  await cleanupTmp();
  const file = path.join(tmpdir, 'big.txt');
  const N = 5000;
  const contents = Array(N).fill(0).map((_, i) => 'row-' + i).join('\n');
  await fs.writeFile(file, contents);
  let count = 0;
  for await (const line of readLines(file)) {
    assert(line.startsWith('row-'));
    count++;
  }
  assert.equal(count, N);
});

test('readLines returns nothing for missing or binary files', async () => {
  await cleanupTmp();
  let lines = [];
  for await (const l of readLines(path.join(tmpdir, 'notfound.txt'))) {
    lines.push(l);
  }
  assert.deepEqual(lines, []);

  // Write a binary file and try reading
  const file = path.join(tmpdir, 'bin.bin');
  await fs.writeFile(file, Buffer.from([0, 1, 0xff, 0x42, 0x43]));
  lines = [];
  for await (const l of readLines(file)) {
    lines.push(l);
  }
  // Usually an empty yield, even if binary; utils.js only reads
  assert.deepEqual(lines, []);
});

test('readLines handles UTF-8 properly', async () => {
  await cleanupTmp();
  const lines = [
    'plain ascii',
    'ümlaut ÄÖÜ',
    '日本語テキスト',
    'emoji 😺😻',
  ];
  const file = path.join(tmpdir, 'utf.txt');
  await fs.writeFile(file, lines.join('\n'), { encoding: 'utf8' });
  const got = [];
  for await (const l of readLines(file)) {
    got.push(l);
  }
  assert.deepEqual(got, lines);
});
