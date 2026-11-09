import { PLAN_CATALOG } from '@aido/api/vocabulary';

import {
  createEntitlementSnapshot,
  createFeatureQuotaDto,
} from '../__tests__/entitlement.fixtures';
import { toFeatureQuota } from '../apis/entitlement.mapper';
import { EntitlementPolicy } from '../domains/entitlement.model';
import {
  getPlanBenefitAmounts,
  getPlanComparison,
  toBenefitQuotaLabel,
  toPlanFeatureComparison,
} from './plan-benefit.view-model';

describe('getPlanBenefitAmounts', () => {
  it('무료 사용자의 친구 수는 초대로 늘어난 서버 한도를 쓰고 프리미엄 양은 카탈로그를 쓴다', () => {
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
    });
  });

  it.each(['PREMIUM', 'ADMIN'] as const)(
    '%s에게도 무료 쪽은 카탈로그의 무료 양을 보여 준다',
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
      });
    },
  );
});

describe('getPlanComparison', () => {
  it('AI 할 일 만들기는 무료 한도와 프리미엄 공정 사용 상한을 월 단위로 견준다', () => {
    // Given
    const snapshot = createEntitlementSnapshot();

    // When
    const comparison = getPlanComparison(snapshot, 'AI_PARSE');

    // Then
    expect(comparison).toEqual({
      unit: 'perMonth',
      free: PLAN_CATALOG.AI_PARSE.free,
      premium: PLAN_CATALOG.AI_PARSE.fairUse.premium,
    });
  });

  it('친구는 초대로 늘어난 서버 한도를 무료 쪽에 쓰고 프리미엄은 무제한이다', () => {
    // Given
    const snapshot = EntitlementPolicy.withFeatureQuota(
      createEntitlementSnapshot(),
      toFeatureQuota({ ...createFeatureQuotaDto('FRIEND'), limit: 7 }),
    );

    // When
    const comparison = getPlanComparison(snapshot, 'FRIEND');

    // Then
    expect(comparison).toEqual({ unit: 'people', free: 7, premium: null });
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

describe('toPlanFeatureComparison', () => {
  it('콕 찌르기와 응원은 같은 한도라 비교표 한 줄로 보여도 맞다', () => {
    // Given
    const snapshot = createEntitlementSnapshot();

    // When
    const nudge = toPlanFeatureComparison(snapshot, 'NUDGE');
    const cheer = toPlanFeatureComparison(snapshot, 'CHEER');

    // Then
    expect(nudge).toEqual(cheer);
    expect(nudge.premium).toEqual({ type: 'unlimited' });
  });
});
