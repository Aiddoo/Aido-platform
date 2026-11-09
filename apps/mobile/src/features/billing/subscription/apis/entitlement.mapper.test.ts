import { entitlementSnapshotSchema, PLAN_FEATURE_KEYS } from '@aido/api';
import { toInstant } from '@src/shared/date/instant';

import { createEntitlementSnapshotDto, MONTHLY_RESETS_AT } from '../__tests__/entitlement.fixtures';
import { toEntitlementSnapshot } from './entitlement.mapper';

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
