import type { subscription as subscriptionTable } from "#api/platform/database/schema/billing.schema";

import { TrialEndingNotice } from "../../domain/trial-ending-notice.entity.js";

type TrialEndingNoticeRow = Pick<
  typeof subscriptionTable.$inferSelect,
  "id" | "userId" | "status" | "productId" | "startedAt" | "expiresAt"
>;

export function toTrialEndingNotice(row: TrialEndingNoticeRow): TrialEndingNotice {
  return TrialEndingNotice.reconstitute(row);
}
