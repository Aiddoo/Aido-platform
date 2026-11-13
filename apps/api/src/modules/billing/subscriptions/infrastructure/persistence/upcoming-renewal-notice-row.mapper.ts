import type { subscription as subscriptionTable } from "#api/platform/database/schema/billing.schema";

import { UpcomingRenewalNotice } from "../../domain/upcoming-renewal-notice.entity.js";

type UpcomingRenewalNoticeRow = Pick<
  typeof subscriptionTable.$inferSelect,
  "id" | "userId" | "expiresAt"
>;

export function toUpcomingRenewalNotice(
  row: UpcomingRenewalNoticeRow,
  isCurrentChain: boolean,
): UpcomingRenewalNotice {
  return UpcomingRenewalNotice.reconstitute({ ...row, isCurrentChain });
}
