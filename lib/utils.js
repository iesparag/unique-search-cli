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
export async function isBinaryFile(filePath) {
  let fd;
  try {
    fd = fsSync.openSync(filePath, 'r');
    const buffer = Buffer.alloc(512);
    const bytesRead = fsSync.readSync(fd, buffer, 0, 512, 0);
    let suspicious = 0;
    let total = bytesRead;
    let utf8Valid = true;
    let i = 0;
    while (i < bytesRead) {
      const byte = buffer[i];
      if (byte === 0) suspicious++;
      if (byte < 7 || (byte > 13 && byte < 32)) suspicious++;
      if (byte > 127) {
        // check multibyte utf-8 sequence
        if (byte >> 5 === 0b110 && i + 1 < bytesRead) {
          // 2-byte seq
          if ((buffer[i + 1] & 0xc0) !== 0x80) utf8Valid = false;
          i += 2; continue;
        } else if (byte >> 4 === 0b1110 && i + 2 < bytesRead) {
          // 3-byte
          if ((buffer[i + 1] & 0xc0) !== 0x80 || (buffer[i + 2] & 0xc0) !== 0x80) utf8Valid = false;
          i += 3; continue;
        } else if (byte >> 3 === 0b11110 && i + 3 < bytesRead) {
          // 4-byte
          if ((buffer[i + 1] & 0xc0) !== 0x80 || (buffer[i + 2] & 0xc0) !== 0x80 || (buffer[i + 3] & 0xc0) !== 0x80) utf8Valid = false;
          i += 4; continue;
        } else {
          utf8Valid = false;
        }
        suspicious++;
      }
      i++;
    }
    fsSync.closeSync(fd);
    if (!utf8Valid) return true;
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
 * Check if target path exists and is readable.
 * Throws if not.
 * @param {string} p
 */
export async function validatePathReadable(p) {
  try {
    await fs.access(p, fs.constants.R_OK);
    await fs.lstat(p); // May throw on missing
  } catch (err) {
    throw new Error(`Cannot access target path: ${p}`);
  }
}

/**
 * Recursively yield readable, non-binary files under the given path.
 * Skips unreadable, binary, or symlinked files.
 * Calls onWarning({path,reason}) on any skipped file.
 * @param {string} p - A file or directory path
 * @param {function} [onWarning] - Optional: called as onWarning({path,reason})
 * @yields {string} - Path to readable file
 */
export async function* listFiles(p, onWarning) {
  let statL;
  try {
    statL = await fs.lstat(p);
    if (statL.isSymbolicLink()) {
      if (onWarning) onWarning({ path: p, reason: 'Symlink skipped' });
      return;
    }
  } catch (err) {
    if (onWarning) onWarning({ path: p, reason: 'Path does not exist' });
    return;
  }
  // Use stat for type
  let stat;
  try {
    stat = await fs.stat(p);
  } catch (err) {
    if (onWarning) onWarning({ path: p, reason: 'Cannot stat path' });
    return;
  }

  if (stat.isFile()) {
    // Only yield if readable and not binary
    try {
      await fs.access(p, fs.constants.R_OK);
    } catch (err) {
      if (onWarning) onWarning({ path: p, reason: 'File unreadable' });
      return;
    }
    if (await isBinaryFile(p)) {
      if (onWarning) onWarning({ path: p, reason: 'Binary file skipped' });
      return;
    }
    yield p;
  } else if (stat.isDirectory()) {
    let entries = [];
    try {
      entries = await fs.readdir(p, { withFileTypes: true });
    } catch (err) {
      if (onWarning) onWarning({ path: p, reason: 'Cannot read directory' });
      return;
    }
    for (const entry of entries) {
      if (entry.name === '.' || entry.name === '..') continue;
      const childPath = path.join(p, entry.name);
      // skip symlinks
      if (entry.isSymbolicLink && entry.isSymbolicLink()) {
        if (onWarning) onWarning({ path: childPath, reason: 'Symlink skipped' });
        continue;
      }
      if (entry.isDirectory()) {
        yield* listFiles(childPath, onWarning);
      } else if (entry.isFile()) {
        try {
          await fs.access(childPath, fs.constants.R_OK);
        } catch (err) {
          if (onWarning) onWarning({ path: childPath, reason: 'File unreadable' });
          continue;
        }
        if (await isBinaryFile(childPath)) {
          if (onWarning) onWarning({ path: childPath, reason: 'Binary file skipped' });
          continue;
        }
        yield childPath;
      }
    }
  }
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
    stream = fsSync.createReadStream(filePath, {
      encoding: 'utf8',
      flags: 'r',
      autoClose: true
    });
  } catch (err) {
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
    // Partial/corrupt utf8 - skip
  } finally {
    rl.close();
    // wait for rl to fully close to not lose lines
    await new Promise(res => rl.once('close', res));
    if (stream) stream.destroy();
  }
}
