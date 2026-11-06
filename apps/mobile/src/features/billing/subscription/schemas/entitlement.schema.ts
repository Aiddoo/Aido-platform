import { ACCESS_TIERS, PLAN_FEATURE_KEYS, PLAN_QUOTA_PERIODS } from '@aido/api/vocabulary';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

export const entitlementFeatureSchema = z.enum(PLAN_FEATURE_KEYS);
export type EntitlementFeature = z.infer<typeof entitlementFeatureSchema>;

const accessTierSchema = z.enum(ACCESS_TIERS);
export type AccessTier = z.infer<typeof accessTierSchema>;

const quotaPeriodSchema = z.enum(PLAN_QUOTA_PERIODS);
export type QuotaPeriod = z.infer<typeof quotaPeriodSchema>;

/** 서버가 계산한 기능 하나의 한도·사용량. 앱은 이 값을 그대로 쓰고 다시 계산하지 않는다 */
export const featureQuotaSchema = z.object({
  feature: entitlementFeatureSchema,
  allowed: z.boolean(),
  /** null은 정말 무제한(ADMIN, 켜진 flag)일 때만이다. 프리미엄의 넉넉한 한도는 숫자 + isFairUse다 */
  limit: z.int().nonnegative().nullable(),
  used: z.int().nonnegative().nullable(),
  remaining: z.int().nonnegative().nullable(),
  period: quotaPeriodSchema.nullable(),
  resetsAt: instantSchema.nullable(),
  isFairUse: z.boolean(),
  perUse: z
    .object({ maxSeconds: z.int().positive(), maxCharacters: z.int().positive() })
    .nullable(),
});
export type FeatureQuota = z.infer<typeof featureQuotaSchema>;

export const entitlementSnapshotSchema = z.object({
  /** 유효한 스토어 구독·보상 기간이 있는지. ADMIN은 반영하지 않는다 */
  isPremium: z.boolean(),
  tier: accessTierSchema,
  features: z.partialRecord(entitlementFeatureSchema, featureQuotaSchema),
});
export type EntitlementSnapshot = z.infer<typeof entitlementSnapshotSchema>;
