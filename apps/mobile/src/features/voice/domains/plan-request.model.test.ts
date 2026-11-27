import { createApiError } from '@src/testing/core';

import { PlanRequestPolicy } from './plan-request.model';

describe('PlanRequestPolicy', () => {
  describe('preparePlanRequest', () => {
    it('같은 내용을 다시 보내면 처음 키를 다시 쓴다', () => {
      // Given
      let count = 0;
      const createIdempotencyKey = () => `key-${++count}`;
      const first = PlanRequestPolicy.preparePlanRequest({
        previous: null,
        input: { text: '장보기' },
        createIdempotencyKey,
      });

      // When
      const retry = PlanRequestPolicy.preparePlanRequest({
        previous: first,
        input: { text: '장보기' },
        createIdempotencyKey,
      });

      // Then
      expect(retry.idempotencyKey).toBe('key-1');
    });

    it('내용을 고쳐 보내면 새 키를 만든다', () => {
      // Given
      let count = 0;
      const createIdempotencyKey = () => `key-${++count}`;
      const first = PlanRequestPolicy.preparePlanRequest({
        previous: null,
        input: { text: '장보기' },
        createIdempotencyKey,
      });

      // When
      const edited = PlanRequestPolicy.preparePlanRequest({
        previous: first,
        input: { text: '장보기 우유' },
        createIdempotencyKey,
      });

      // Then
      expect(edited.idempotencyKey).toBe('key-2');
    });
  });

  describe('findRequestToRetry', () => {
    const previous = { fingerprint: 'a', idempotencyKey: 'key-1', input: 'a' };

    it('내용이 다르다는 AI_1318 뒤에는 다음에 누를 때 새 키를 만든다', () => {
      // Given
      const error = createApiError('AI_1318', { message: '오류' });

      // When
      const next = PlanRequestPolicy.findRequestToRetry(previous, error);

      // Then
      expect(next).toBeNull();
    });

    it('처리 중(AI_1314)·네트워크 오류 뒤에는 같은 키를 다시 쓴다', () => {
      // Given
      const error = createApiError('AI_1314', { message: '처리 중' });

      // When
      const next = PlanRequestPolicy.findRequestToRetry(previous, error);

      // Then
      expect(next).toBe(previous);
    });
  });
});
