import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { resolveTestWorkers } from './test-workers.mjs';

describe('테스트 worker 수', () => {
  test('AIDO_TEST_WORKERS가 없거나 비어 있으면 러너의 기본값을 쓴다', () => {
    // Given
    const unset = {};
    const empty = { AIDO_TEST_WORKERS: '' };

    // When & Then
    assert.equal(resolveTestWorkers(unset, '50%'), '50%');
    assert.equal(resolveTestWorkers(empty, 4), 4);
  });

  test('양의 정수는 숫자로 돌려준다', () => {
    // Given
    const env = { AIDO_TEST_WORKERS: '4' };

    // When & Then
    assert.equal(resolveTestWorkers(env, '50%'), 4);
  });

  test('1%부터 100%까지의 비율은 그대로 돌려준다', () => {
    // Given & When & Then
    assert.equal(resolveTestWorkers({ AIDO_TEST_WORKERS: '1%' }, 4), '1%');
    assert.equal(resolveTestWorkers({ AIDO_TEST_WORKERS: '25%' }, 4), '25%');
    assert.equal(resolveTestWorkers({ AIDO_TEST_WORKERS: '100%' }, 4), '100%');
  });

  test('정수·비율이 아닌 값은 이름과 받은 값을 담아 거부한다', () => {
    // Given
    const invalid = ['0', '-1', '1.5', '04', '0%', '101%', '50 %', 'half'];

    // When & Then
    for (const value of invalid) {
      assert.throws(() => resolveTestWorkers({ AIDO_TEST_WORKERS: value }, '50%'), {
        message: `AIDO_TEST_WORKERS must be a positive integer or a percentage from 1% to 100%, received "${value}"`,
      });
    }
  });
});
