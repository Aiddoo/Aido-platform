import { type EntitlementSnapshot as EntitlementSnapshotDto, PLAN_FEATURE_KEYS } from '@aido/api';
import { mapValues, pick } from 'es-toolkit';

import {
  type EntitlementSnapshot,
  entitlementSnapshotSchema,
  toFeatureQuota,
} from '../schemas/entitlement.schema';

// 새 서버가 더한 모르는 기능 키는 버린다
export function toEntitlementSnapshot(dto: EntitlementSnapshotDto): EntitlementSnapshot {
  return entitlementSnapshotSchema.parse({
    isPremium: dto.isPremium,
    tier: dto.tier,
    features: mapValues(pick(dto.features, PLAN_FEATURE_KEYS), toFeatureQuota),
  } satisfies Record<keyof EntitlementSnapshotDto, unknown>);
}
