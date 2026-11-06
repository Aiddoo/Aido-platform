import { PLAN_CATALOG } from '@aido/api/vocabulary';

import {
  createEntitlementSnapshot,
  createFeatureQuotaDto,
} from '../../__tests__/entitlement.factories';
import { toFeatureQuota } from '../../apis/entitlement.mapper';
import { EntitlementPolicy } from '../../domains/entitlement.model';
import { toPlanBenefitAmounts } from './plan-benefit.view-model';

describe('toPlanBenefitAmounts', () => {
  it('무료 사용자의 친구 수는 초대로 늘어난 서버 한도를 쓰고 프리미엄 양은 카탈로그를 쓴다', () => {
    // Given
    const snapshot = EntitlementPolicy.withFeatureQuota(
      createEntitlementSnapshot(),
      toFeatureQuota({ ...createFeatureQuotaDto('FRIEND'), limit: 7 }),
    );

    // When
    const amounts = toPlanBenefitAmounts(snapshot);

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
      const amounts = toPlanBenefitAmounts(snapshot);

      // Then
      expect(amounts.free).toEqual({
        aiParse: PLAN_CATALOG.AI_PARSE.free,
        voiceNote: PLAN_CATALOG.VOICE_NOTE.free,
        voiceNoteMinutes: 3,
        nudge: PLAN_CATALOG.NUDGE.free,
        friend: PLAN_CATALOG.FRIEND.free,
        category: PLAN_CATALOG.TODO_CATEGORY.free,
      });
    },
  );
});
