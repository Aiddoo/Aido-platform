import { PLAN_CATALOG } from '@aido/api/vocabulary';

import {
  createEntitlementSnapshot,
  createFeatureQuotaDto,
} from '../__tests__/entitlement.fixtures';
import { toFeatureQuota } from '../apis/entitlement.mapper';
import { EntitlementPolicy } from '../domains/entitlement.model';
import {
  excludeBlockedBenefit,
  getPlanBenefitAmounts,
  getPlanComparison,
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

describe('excludeBlockedBenefit', () => {
  const benefits = [
    { feature: 'AI_PARSE' },
    { feature: 'CUSTOM_REMINDER_TIME' },
    { feature: 'NUDGE' },
    { feature: 'APP_ICON' },
  ] as const;

  it('막힌 기능은 빼고 나머지 순서는 그대로 둔다', () => {
    // When
    const visible = excludeBlockedBenefit(benefits, 'NUDGE');

    // Then
    expect(visible.map(({ feature }) => feature)).toEqual([
      'AI_PARSE',
      'CUSTOM_REMINDER_TIME',
      'APP_ICON',
    ]);
  });

  it.each([
    ['막힌 기능을 모르면', undefined],
    ['목록에 없는 기능이면', 'FRIEND'],
  ] as const)('%s 모두 보여 준다', (_case, feature) => {
    // When
    const visible = excludeBlockedBenefit(benefits, feature);

    // Then
    expect(visible).toEqual(benefits);
  });
});
