// test/config.test.js
// Skeleton for config module tests

import { parseConfig } from '../lib/config.js';
import assert from 'node:assert/strict';
import test from 'node:test';

test('parseConfig returns object', () => {
  assert.equal(typeof parseConfig(), 'object');
});
