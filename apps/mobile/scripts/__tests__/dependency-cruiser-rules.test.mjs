import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { forbidden } = require('../../.dependency-cruiser.cjs');

function toPatterns(value) {
  return [value ?? []].flat().map((pattern) => new RegExp(pattern));
}

function matches({ path, pathNot }, file) {
  return (
    toPatterns(path).some((pattern) => pattern.test(file)) &&
    !toPatterns(pathNot).some((pattern) => pattern.test(file))
  );
}

function violates(ruleName, from, to) {
  const rule = forbidden.find(({ name }) => name === ruleName);
  assert.ok(rule, `${ruleName} 규칙이 없다`);
  return matches(rule.from, from) && matches(rule.to, to);
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
  const results = production.map((from) => violates('testing-from-production', from, TESTING_FILE));

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
  const results = tests.map((from) => violates('testing-from-production', from, TESTING_FILE));

  // Then
  assert.deepEqual(results, [false, false, false]);
});

// 포트 파일 이름이 바뀌면(logger → app-logger) 규칙이 조용히 끊긴다. 지금 포트 이름으로 막는지 본다
test('mapper와 cache helper가 지금 로거·보고 포트를 import하면 막는다', () => {
  // Given
  const cases = [
    [
      'mapper-purity',
      'src/features/notes/memo/apis/memo.mapper.ts',
      'src/core/ports/app-logger.ts',
    ],
    [
      'mapper-purity',
      'src/features/notes/memo/apis/memo.mapper.ts',
      'src/core/ports/error-reporter.ts',
    ],
    [
      'cache-helper-purity',
      'src/features/notes/memo/queries/memo-cache.ts',
      'src/core/ports/app-logger.ts',
    ],
  ];

  // When
  const results = cases.map(([ruleName, from, to]) => violates(ruleName, from, to));

  // Then
  assert.deepEqual(results, [true, true, true]);
});

test('feature는 di-context 밖의 bootstrap을 import하지 못한다', () => {
  // Given
  const from = 'src/features/voice/queries/voice.mutations.ts';
  const targets = [
    'src/bootstrap/query/mutation-error-feedback.tsx',
    'src/bootstrap/providers/di-context.tsx',
  ];

  // When
  const results = targets.map((to) => violates('feature-to-bootstrap', from, to));

  // Then
  assert.deepEqual(results, [true, false]);
});

test('계약은 기능의 apis·schemas만 import하고 그 밖의 기능 폴더는 막는다', () => {
  // Given
  const contract = '../../packages/api/src/contracts/auth/index.ts';
  const importers = [
    'src/features/identity/auth/services/sign-in.service.ts',
    'src/features/device/widget/stores/widget.store.ts',
    'src/features/identity/auth/apis/auth.mapper.ts',
    'src/features/identity/auth/schemas/auth-request.schema.ts',
  ];

  // When
  const results = importers.map((from) => violates('client-model-contract', from, contract));

  // Then
  assert.deepEqual(results, [true, true, false, false]);
});

test('Zod는 기능의 schemas와 도메인 모델 밖에서 import하지 못한다', () => {
  // Given
  const zod = '../../node_modules/.pnpm/zod@4.6.7/node_modules/zod/index.js';
  const importers = [
    'src/features/device/widget/repositories/widget.repository.ts',
    'src/features/identity/auth/schemas/auth-request.schema.ts',
    'src/features/identity/auth/domains/auth.model.ts',
  ];

  // When
  const results = importers.map((from) => violates('zod-outside-schemas', from, zod));

  // Then
  assert.deepEqual(results, [true, false, false]);
});
