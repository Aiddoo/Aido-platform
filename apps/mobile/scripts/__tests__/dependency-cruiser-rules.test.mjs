import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { forbidden } = require('../../.dependency-cruiser.cjs');

const rule = forbidden.find(({ name }) => name === 'testing-from-production');

function toPatterns(value) {
  return [value ?? []].flat().map((pattern) => new RegExp(pattern));
}

function violates(from, to) {
  const matchesFrom =
    toPatterns(rule.from.path).some((pattern) => pattern.test(from)) &&
    !toPatterns(rule.from.pathNot).some((pattern) => pattern.test(from));
  return matchesFrom && toPatterns(rule.to.path).some((pattern) => pattern.test(to));
}

const TESTING_FILE = 'src/testing/ports/analytics.stub.ts';

test('운영 코드가 src/testing을 import하면 막는다', () => {
  // Given
  const production = [
    'src/features/notes/memo/hooks/use-memo.ts',
    'src/shared/ui/button.tsx',
    'app/index.tsx',
  ];

  // When
  const results = production.map((from) => violates(from, TESTING_FILE));

  // Then
  assert.deepEqual(results, [true, true, true]);
});

test('테스트와 src/testing 안에서는 src/testing을 import할 수 있다', () => {
  // Given
  const tests = [
    'src/features/notes/memo/hooks/use-memo.test.tsx',
    'src/features/notes/memo/__tests__/memo.fixtures.ts',
    'src/testing/di.ts',
  ];

  // When
  const results = tests.map((from) => violates(from, TESTING_FILE));

  // Then
  assert.deepEqual(results, [false, false, false]);
});
