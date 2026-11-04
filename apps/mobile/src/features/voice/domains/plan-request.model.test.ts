import { preparePlanRequest } from './plan-request.model';

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
