import { entitlementSnapshotSchema, PLAN_FEATURE_KEYS } from '@aido/api';
import { ErrorCode } from '@aido/api/errors';
import { ApiError } from '@src/core/errors/api-error';
import { toInstant } from '@src/shared/date/instant';

import {
  createEntitlementSnapshotDto,
  createFeatureQuotaDto,
  createLimitApiError,
  MONTHLY_RESETS_AT,
} from '../__tests__/entitlement.fixtures';
import { parseLimitedFeature, toEntitlementSnapshot, toFeatureQuota } from './entitlement.mapper';

describe('toEntitlementSnapshot', () => {
  it('초기화 시각을 Instant로 옮기고 모든 기능 한도를 옮긴다', () => {
    // Given
    const dto = createEntitlementSnapshotDto({ used: { AI_PARSE: 3 } });

    // When
    const snapshot = toEntitlementSnapshot(dto);

    // Then
    expect(Object.keys(snapshot.features)).toEqual([...PLAN_FEATURE_KEYS]);
    expect(snapshot.features.AI_PARSE).toEqual({
      feature: 'AI_PARSE',
      allowed: true,
      limit: 10,
      used: 3,
      remaining: 7,
      period: 'month',
      resetsAt: toInstant(MONTHLY_RESETS_AT),
      isFairUse: false,
      perUse: null,
    });
  });

  it('새 서버가 더한 모르는 기능 키는 버린다', () => {
    // Given
    const dto = entitlementSnapshotSchema.parse({
      ...createEntitlementSnapshotDto(),
      features: { ...createEntitlementSnapshotDto().features, FUTURE_FEATURE: { allowed: true } },
    });

    // When
    const snapshot = toEntitlementSnapshot(dto);

    // Then
    expect(snapshot.features).not.toHaveProperty('FUTURE_FEATURE');
  });

  it('관리자는 등급을 ADMIN으로 두고 유료 효력은 서버 값을 그대로 쓴다', () => {
    // Given
    const dto = createEntitlementSnapshotDto({ tier: 'ADMIN' });

    // When
    const snapshot = toEntitlementSnapshot(dto);

    // Then
    expect({ tier: snapshot.tier, isPremium: snapshot.isPremium }).toEqual({
      tier: 'ADMIN',
      isPremium: false,
    });
    expect(snapshot.features.AI_PARSE?.limit).toBeNull();
  });
});

describe('parseLimitedFeature', () => {
  it('AI 할 일 만들기 한도 오류는 기능과 서버가 준 현재 한도를 돌려준다', () => {
    // Given
    const featureQuota = createFeatureQuotaDto('AI_PARSE', { used: 10 });
    const error = createLimitApiError(ErrorCode.AI_1303, { charged: false, featureQuota });

    // When
    const limited = parseLimitedFeature(error);

    // Then
    expect(limited).toEqual({ feature: 'AI_PARSE', featureQuota: toFeatureQuota(featureQuota) });
  });

  it('말로 메모하기 한도 오류는 VOICE_NOTE다', () => {
    // Given
    const featureQuota = createFeatureQuotaDto('VOICE_NOTE', { used: 3 });
    const error = createLimitApiError(ErrorCode.AI_1313, { charged: false, featureQuota });

    // When
    const limited = parseLimitedFeature(error);

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
    const limited = parseLimitedFeature(error);

    // Then
    expect(limited).toEqual({ feature, featureQuota: null });
  });

  it('한도가 아닌 오류는 null이다', () => {
    // Given
    const error = new ApiError(ErrorCode.AI_1302, '실패', 422);

    // When
    const limited = parseLimitedFeature(error);

    // Then
    expect(limited).toBeNull();
  });
});
