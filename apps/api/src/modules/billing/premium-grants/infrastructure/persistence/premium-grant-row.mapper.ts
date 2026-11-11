import type { premiumGrant as premiumGrantTable } from "#api/platform/database/schema/billing.schema";

import { PremiumGrant } from "../../domain/premium-grant.aggregate.js";

type PremiumGrantRow = typeof premiumGrantTable.$inferSelect;
type PremiumGrantInsertRow = typeof premiumGrantTable.$inferInsert;

export function toPremiumGrant(row: PremiumGrantRow): PremiumGrant {
  return PremiumGrant.reconstitute(row);
}

export function toPremiumGrantRow(grant: PremiumGrant): PremiumGrantInsertRow {
  return grant.toPrimitives();
}
