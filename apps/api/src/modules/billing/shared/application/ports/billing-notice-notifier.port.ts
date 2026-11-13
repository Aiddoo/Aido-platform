import type { BillingNotice } from "./billing-notice.repository.port.js";

export abstract class BillingNoticeNotifierPort<TNotice extends BillingNotice> {
  /** 활성 UoW 안에서 알림함 기록과 푸시 outbox를 함께 남긴다. */
  abstract notify(notices: readonly TNotice[], now: Temporal.Instant): Promise<void>;
}
