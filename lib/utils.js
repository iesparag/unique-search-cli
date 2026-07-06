// lib/utils.js
// Filesystem scanning and line reading utilities
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

/**
 * Detect if a file is a binary by reading a small chunk and checking for byte values.
 * Only UTF-8/ASCII are accepted. Binary detection: if >30% bytes are 0 or >127 and not a valid utf8, consider binary.
 * For simplicity, we treat files with nulls or control chars in first chunk as binary.
 *
 * @param {string} filePath
 * @returns {Promise<boolean>} true if file appears binary, else false
 */
async function isBinaryFile(filePath) {
  // Instead of fs.promises, use sync for fast fail and to avoid holding file handle for long
  let fd;
  try {
    fd = fsSync.openSync(filePath, 'r');
    const buffer = Buffer.alloc(512);
    const bytesRead = fsSync.readSync(fd, buffer, 0, 512, 0);
    let suspicious = 0;
    let total = bytesRead;
    for (let i = 0; i < bytesRead; ++i) {
      const byte = buffer[i];
      if (byte === 0) suspicious += 1; // null bytes
      // control chars except newlines/tabs
      if (byte < 7 || (byte > 13 && byte < 32)) suspicious += 1;
      // non-ascii
      if (byte > 127) suspicious += 1;
    }
    fsSync.closeSync(fd);
    return total > 0 && suspicious / total > 0.3;
  } catch (err) {
    if (fd !== undefined) {
      try { fsSync.closeSync(fd); } catch {}
    }
    // Can't open file? Not binary, just unreadable; leave to caller.
    return false;
  }
}

/**
 * Recursively yield readable, non-binary files under the given path.
 * Skips unreadable, binary, or symlinked files.
 * @param {string} p - A file or directory path
 * @yields {string} - Path to readable file
 */
export async function* listFiles(p) {
  let stat;
  try {
    stat = await fs.stat(p);
  } catch (err) {
    // Not found or not accessible
    // Optionally report: console.warn(`Skipping ${p}: ${err.message}`);
    return;
  }

  // Use lstat to skip symlinks/files to symlink
  let statL;
  try {
    statL = await fs.lstat(p);
    if (statL.isSymbolicLink()) return;
  } catch {}

  if (stat.isFile()) {
    // Only yield if readable and not binary
    try {
      await fs.access(p, fs.constants.R_OK);
      if (await isBinaryFile(p)) {
        // Optionally: console.warn(`Skipping binary file: ${p}`);
        return;
      }
      yield p;
    } catch (err) {
      // Optionally: console.warn(`Skipping unreadable file: ${p}`);
      return;
    }
  } else if (stat.isDirectory()) {
    let entries = [];
    try {
      entries = await fs.readdir(p, { withFileTypes: true });
    } catch (err) {
      // Optionally: console.warn(`Skipping unreadable directory: ${p}`);
      return;
    }
    for (const entry of entries) {
      if (entry.name === '.' || entry.name === '..') continue;
      const childPath = path.join(p, entry.name);
      // skip symlinks
      if (entry.isSymbolicLink && entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        yield* listFiles(childPath);
      } else if (entry.isFile()) {
        // Only yield if readable and not binary
        try {
          await fs.access(childPath, fs.constants.R_OK);
          if (await isBinaryFile(childPath)) {
            // Optionally: console.warn(`Skipping binary file: ${childPath}`);
            continue;
          }
          yield childPath;
        } catch (err) {
          // Optionally: console.warn(`Skipping unreadable file: ${childPath}`);
          continue;
        }
      }
      // Else: ignore symlinks, sockets, etc
    }
  }
  // Symlinks, sockets, etc: skipped.
}

/**
 * Async generator to read a file line by line using streams.
 * Properly handles encoding and errors; always yields strings.
 * Skips binary files (nothing yielded if file is binary or can't be opened)
 * @param {string} filePath
 * @yields {string} Each line (excluding EOL)
 */
export async function* readLines(filePath) {
  // Skip missing files and binary files
  let exists = true;
  try {
    await fs.access(filePath, fs.constants.R_OK);
  } catch {
    exists = false;
  }
  if (!exists) return;
  if (await isBinaryFile(filePath)) return;

  let stream;
  try {
    stream = fsSync.createReadStream(filePath, { encoding: 'utf8' });
  } catch (err) {
    // File couldn't be opened; return nothing.
    if (stream) stream.destroy();
    return;
  }

  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  });

  try {
    for await (const line of rl) {
      yield line;
    }
  } catch (err) {
    // Maybe partially corrupt UTF-8 lines, skip
    // Optionally: console.warn(`Error reading ${filePath}: ${err.message}`);
  } finally {
    rl.close();
    if (stream) stream.destroy();
  }
}
