import { defineStoredValue, storedJsonSchema } from '@src/shared/storage/define-stored-value';
import { z } from 'zod';

import { FEATURE_KEYS, type FeatureKey } from '../feature-key';

/** 탈퇴 정리가 앱이 더는 모르는 기능의 기록까지 이 앞부분으로 찾는다 */
export function toFeatureAttributionKeyPrefix(accountId: string): string {
  return `aido_feature_attribution_v1:${accountId}:`;
}

/** 출시 소개 CTA를 누른 기록. 계정·기능마다 한 칸이고 그 기능의 첫 성공에서 지운다 */
export const featureAttributionStoredValue = defineStoredValue({
  key: ({ accountId, feature }: { accountId: string; feature: FeatureKey }) =>
    `${toFeatureAttributionKeyPrefix(accountId)}${feature}`,
  schema: storedJsonSchema(
    z.object({
      campaignId: z.string().min(1),
      feature: z.enum(FEATURE_KEYS),
      expiresAt: z.number().int().positive(),
    }),
  ),
  fallback: null,
});
