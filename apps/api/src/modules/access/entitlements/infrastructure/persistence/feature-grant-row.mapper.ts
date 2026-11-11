import type { resourceBonus as featureGrantTable } from "#api/platform/database/schema/access.schema";

import type { FeatureGrant } from "../../domain/feature-grant.aggregate.js";

type FeatureGrantInsertRow = typeof featureGrantTable.$inferInsert;

// 테이블·칸 이름(ResourceBonus.resource)은 배포된 DB 이름이라 그대로 둔다
export function toFeatureGrantRow(grant: FeatureGrant): FeatureGrantInsertRow {
  const { feature, ...rest } = grant.toPrimitives();
  return { ...rest, resource: feature };
}
