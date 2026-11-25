import { PLAN_CATALOG } from '@aido/api/vocabulary';

import {
  createEntitlementSnapshot,
  createFeatureQuotaDto,
} from '../__tests__/entitlement.fixtures';
import { toFeatureQuota } from '../apis/entitlement.mapper';
import { EntitlementPolicy } from '../domains/entitlement.model';
import { getPlanBenefitAmounts, toBenefitQuotaLabel } from './plan-benefit.view-model';

describe('getPlanBenefitAmounts', () => {
  it('무료 사용자의 친구 수는 초대로 늘어난 서버 한도를 쓰고 프리미엄 양은 서버 요금제 값을 쓴다', () => {
    // Given
    const snapshot = EntitlementPolicy.withFeatureQuota(
      createEntitlementSnapshot(),
      toFeatureQuota({ ...createFeatureQuotaDto('FRIEND'), limit: 7 }),
    );

    // When
    const amounts = getPlanBenefitAmounts(snapshot);

    // Then
    expect(amounts.free.friend).toBe(7);
    expect(amounts.premium).toEqual({
      aiParse: PLAN_CATALOG.AI_PARSE.fairUse.premium,
      voiceNote: PLAN_CATALOG.VOICE_NOTE.fairUse.premium,
      voiceNoteMinutes: 30,
      category: PLAN_CATALOG.TODO_CATEGORY.premium,
      calendarImportDays: PLAN_CATALOG.CALENDAR_IMPORT.premium,
    });
  });

  it.each(['PREMIUM', 'ADMIN'] as const)(
    '%s에게도 무료 쪽은 서버의 무료 요금제 양을 보여 준다',
    (tier) => {
      // Given
      const snapshot = createEntitlementSnapshot({ tier });

      // When
      const amounts = getPlanBenefitAmounts(snapshot);

      // Then
      expect(amounts.free).toEqual({
        aiParse: PLAN_CATALOG.AI_PARSE.free,
        voiceNote: PLAN_CATALOG.VOICE_NOTE.free,
        voiceNoteMinutes: 3,
        nudge: PLAN_CATALOG.NUDGE.free,
        cheer: PLAN_CATALOG.CHEER.free,
        friend: PLAN_CATALOG.FRIEND.free,
        category: PLAN_CATALOG.TODO_CATEGORY.free,
        calendarImportDays: PLAN_CATALOG.CALENDAR_IMPORT.free,
      });
    },
  );
});

describe('운영 중 바뀐 요금제 값', () => {
  it('앱에 묶인 카탈로그와 달라도 결제 화면은 서버가 보낸 무료·프리미엄 숫자를 그린다', () => {
    // Given
    // 운영에서 카테고리 한도를 무료 5개·프리미엄 50개로 올렸다
    const changed = { allowed: true, isFairUse: false, perUse: null };
    const snapshot = createEntitlementSnapshot({
      tier: 'PREMIUM',
      plans: {
        TODO_CATEGORY: {
          free: { ...changed, limit: 5 },
          premium: { ...changed, limit: 50 },
        },
      },
    });

    // When
    const amounts = getPlanBenefitAmounts(snapshot);
    const comparison = EntitlementPolicy.getPlanFeatureComparison(snapshot, 'TODO_CATEGORY');

    // Then
    expect([amounts.free.category, amounts.premium.category]).toEqual([5, 50]);
    expect(comparison).toEqual({
      free: { type: 'amount', unit: 'items', amount: 5 },
      premium: { type: 'amount', unit: 'items', amount: 50 },
    });
  });
});

describe('toBenefitQuotaLabel', () => {
  it('무료에 없는 AI 리포트는 프리미엄 전용이다', () => {
    // Given
    const snapshot = createEntitlementSnapshot();

    // When
    const label = toBenefitQuotaLabel(snapshot, 'AI_REPORT');

    // Then
    expect(label).toEqual({ type: 'premiumOnly' });
  });

  it('초대로 늘어난 무료 한도와 프리미엄 상한을 견준다', () => {
    // Given
    const snapshot = EntitlementPolicy.withFeatureQuota(
      createEntitlementSnapshot(),
      toFeatureQuota({ ...createFeatureQuotaDto('AI_PARSE'), limit: 15 }),
    );

    // When
    const label = toBenefitQuotaLabel(snapshot, 'AI_PARSE');

    // Then
    expect(label).toEqual({
      type: 'upgrade',
      free: { type: 'amount', unit: 'perMonth', amount: 15 },
      premium: { type: 'amount', unit: 'perMonth', amount: PLAN_CATALOG.AI_PARSE.fairUse.premium },
    });
  });
});
