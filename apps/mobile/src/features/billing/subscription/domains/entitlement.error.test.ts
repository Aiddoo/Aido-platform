import { ErrorCode } from '@aido/api/errors';
import { ServerError } from '@src/shared/errors';
import { createApiError } from '@src/testing/core';

import { isFreeOfChargeError } from './entitlement.error';

describe('isFreeOfChargeError', () => {
  it.each([
    [
      '차감하지 않았다고 알린 오류',
      createApiError(ErrorCode.AI_1314, { message: '처리 중', details: { charged: false } }),
      true,
    ],
    [
      'AI 업체 장애(503)로 차감하지 않았다고 알린 오류',
      new ServerError(503, {
        serverCode: ErrorCode.AI_1301,
        details: { charged: false },
        requestId: null,
        request: null,
      }),
      true,
    ],
    [
      '상세가 없는 5xx',
      new ServerError(503, {
        serverCode: ErrorCode.AI_1301,
        details: null,
        requestId: null,
        request: null,
      }),
      false,
    ],
    ['상세가 없는 오류', createApiError(ErrorCode.AI_1314, { message: '처리 중' }), false],
    ['서버 오류가 아닌 값', new Error('network'), false],
  ] as const)('%s', (_case, error, expected) => {
    // When
    const result = isFreeOfChargeError(error);

    // Then
    expect(result).toBe(expected);
  });
});
