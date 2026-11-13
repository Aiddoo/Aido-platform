import type { premiumGrant as premiumGrantTable } from "#api/platform/database/schema/billing.schema";

import { PremiumGrantEndingNotice } from "../../domain/premium-grant-ending-notice.entity.js";

type PremiumGrantRow = typeof premiumGrantTable.$inferSelect;

// 안내 후보는 끝나는 시각이 있는 ACTIVE 기간뿐이다
type PremiumGrantEndingNoticeRow = Pick<PremiumGrantRow, "id" | "userId"> & {
  readonly endsAt: Temporal.Instant;
};

export function toPremiumGrantEndingNotice(
  row: PremiumGrantEndingNoticeRow,
): PremiumGrantEndingNotice {
  return PremiumGrantEndingNotice.reconstitute(row);
}
