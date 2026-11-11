import { ErrorCode } from '@aido/api/errors';
import { ApiError } from '@src/core/errors/api-error';

import { isFreeOfChargeError } from './entitlement.error';

describe('isFreeOfChargeError', () => {
  it.each([
    [
      '차감하지 않았다고 알린 오류',
      new ApiError(ErrorCode.AI_1314, '처리 중', 409, { charged: false }),
      true,
    ],
    ['상세가 없는 오류', new ApiError(ErrorCode.AI_1301, '장애', 422), false],
    ['서버 오류가 아닌 값', new Error('network'), false],
  ] as const)('%s', (_case, error, expected) => {
    // When
    const result = isFreeOfChargeError(error);

    // Then
    expect(result).toBe(expected);
  });
});
