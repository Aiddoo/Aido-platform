import {
  type BillingNotice,
  BillingNoticeNotifierPort,
} from "#api/modules/billing/premium-grants/application/ports/billing-notice.port";

export class RecordingBillingNoticeNotifier<
  TNotice extends BillingNotice,
> extends BillingNoticeNotifierPort<TNotice> {
  readonly notified: TNotice[] = [];

  async notify(notices: readonly TNotice[]): Promise<void> {
    this.notified.push(...notices);
  }
}
