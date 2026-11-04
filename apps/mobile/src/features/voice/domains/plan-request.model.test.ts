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

  test('내용이 다르다는 AI_1318 뒤에는 다음에 누를 때 새 키를 만든다', () => {
    // Given
    const error = new ApiError('AI_1318', '오류', 422);

    // When
    const next = PlanRequestPolicy.getAfterFailure(previous, error);

    // Then
    expect(next).toBeNull();
  });

  test('AI_1317을 처음 받으면 추가 차감 없이 다시 만들도록 같은 키를 유지한다', () => {
    // Given
    const error = new ApiError('AI_1317', '오류', 410);

    // When
    const next = PlanRequestPolicy.getAfterFailure(previous, error);

    // Then
    expect(next?.idempotencyKey).toBe('key-1');
  });

  test('같은 키가 또 AI_1317이면 정리할 길이 막히지 않게 다음에 누를 때 새 키를 만든다', () => {
    // Given
    const error = new ApiError('AI_1317', '오류', 410);
    const expired = PlanRequestPolicy.getAfterFailure(previous, error);

    // When
    const next = PlanRequestPolicy.getAfterFailure(expired, error);

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
