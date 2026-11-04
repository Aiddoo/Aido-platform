import { ApiError } from '@src/shared/errors/api-error';

import { PlanRequestPolicy, preparePlanRequest } from './plan-request.model';

describe('preparePlanRequest', () => {
  test('같은 내용을 다시 보내면 처음 키를 다시 쓴다', () => {
    // Given
    let count = 0;
    const createIdempotencyKey = () => `key-${++count}`;
    const first = preparePlanRequest({
      previous: null,
      input: { text: '장보기' },
      createIdempotencyKey,
    });

    // When
    const retry = preparePlanRequest({
      previous: first,
      input: { text: '장보기' },
      createIdempotencyKey,
    });

    // Then
    expect(retry.idempotencyKey).toBe('key-1');
  });

  test('내용을 고쳐 보내면 새 키를 만든다', () => {
    // Given
    let count = 0;
    const createIdempotencyKey = () => `key-${++count}`;
    const first = preparePlanRequest({
      previous: null,
      input: { text: '장보기' },
      createIdempotencyKey,
    });

    // When
    const edited = preparePlanRequest({
      previous: first,
      input: { text: '장보기 우유' },
      createIdempotencyKey,
    });

    // Then
    expect(edited.idempotencyKey).toBe('key-2');
  });
});

describe('getPlanRequestAfterFailure', () => {
  const previous = { fingerprint: 'a', idempotencyKey: 'key-1', input: 'a' };

  test.each(['AI_1317', 'AI_1318'])('%s 뒤에는 다음에 누를 때 새 키를 만든다', (code) => {
    // Given
    const error = new ApiError(code, '오류', 410);

    // When
    const next = PlanRequestPolicy.getAfterFailure(previous, error);

    // Then
    expect(next).toBeNull();
  });

  test('처리 중(AI_1314)·네트워크 오류 뒤에는 같은 키를 다시 쓴다', () => {
    // Given
    const error = new ApiError('AI_1314', '처리 중', 409);

    // When
    const next = PlanRequestPolicy.getAfterFailure(previous, error);

    // Then
    expect(next).toBe(previous);
  });
});
