import { ErrorCode } from '@aido/api/errors';
import { ApiError } from '@src/core/errors/api-error';

import { createFeatureQuotaDto, createLimitApiError } from '../__tests__/entitlement.fixtures';
import { toFeatureQuota } from '../schemas/entitlement.schema';
import { findLimitedFeature, isFreeOfChargeError } from './entitlement.error';

describe('findLimitedFeature', () => {
  it('AI 할 일 만들기 한도 오류는 기능과 서버가 준 현재 한도를 돌려준다', () => {
    // Given
    const featureQuota = createFeatureQuotaDto('AI_PARSE', { used: 10 });
    const error = createLimitApiError(ErrorCode.AI_1303, { charged: false, featureQuota });

    // When
    const limited = findLimitedFeature(error);

    // Then
    expect(limited).toEqual({ feature: 'AI_PARSE', featureQuota: toFeatureQuota(featureQuota) });
  });

  it('말로 메모하기 한도 오류는 VOICE_NOTE다', () => {
    // Given
    const featureQuota = createFeatureQuotaDto('VOICE_NOTE', { used: 3 });
    const error = createLimitApiError(ErrorCode.AI_1313, { charged: false, featureQuota });

    // When
    const limited = findLimitedFeature(error);

    // Then
    expect(limited?.feature).toBe('VOICE_NOTE');
  });

  it.each([
    [ErrorCode.NUDGE_1101, 'NUDGE'],
    [ErrorCode.FOLLOW_0909, 'FRIEND'],
    [ErrorCode.TODO_CATEGORY_0857, 'TODO_CATEGORY'],
    [ErrorCode.AI_1309, 'AI_SUGGESTION'],
  ] as const)('상세가 없는 %s는 기능만 알려 준다', (code, feature) => {
    // Given
    const error = createLimitApiError(code);

    // When
    const limited = findLimitedFeature(error);

    // Then
    expect(limited).toEqual({ feature, featureQuota: null });
  });

  it('한도가 아닌 오류는 null이다', () => {
    // Given
    const error = new ApiError(ErrorCode.AI_1302, '실패', 422);

    // When
    const limited = findLimitedFeature(error);

    // Then
    expect(limited).toBeNull();
  });
});

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
