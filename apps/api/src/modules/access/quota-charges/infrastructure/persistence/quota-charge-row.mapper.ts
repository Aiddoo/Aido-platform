import type { quotaCharge as quotaChargeTable } from "#api/platform/database/schema/access.schema";

import { QuotaCharge } from "../../domain/quota-charge.aggregate.js";

type QuotaChargeRow = typeof quotaChargeTable.$inferSelect;
type QuotaChargeInsertRow = typeof quotaChargeTable.$inferInsert;

export function toQuotaCharge(row: QuotaChargeRow): QuotaCharge {
  return QuotaCharge.reconstitute(row);
}

export function toQuotaChargeRow(charge: QuotaCharge): QuotaChargeInsertRow {
  return charge.toPrimitives();
}
