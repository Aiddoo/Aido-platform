import { BillingNoticeNotifierPort } from "#api/modules/billing/shared/application/ports/billing-notice-notifier.port";
import type { BillingNotice } from "#api/modules/billing/shared/application/ports/billing-notice.repository.port";

export class RecordingBillingNoticeNotifier<
  TNotice extends BillingNotice,
> extends BillingNoticeNotifierPort<TNotice> {
  readonly notified: TNotice[] = [];

  async notify(notices: readonly TNotice[]): Promise<void> {
    this.notified.push(...notices);
  }
}
