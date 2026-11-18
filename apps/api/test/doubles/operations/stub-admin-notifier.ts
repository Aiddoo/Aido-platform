import {
  AdminNotifierPort,
  type AdminNotifyOutcome,
} from "#api/modules/operations/admin-notices/application/ports/admin-notifier.port";
import type { AdminNoticePrimitives } from "#api/modules/operations/admin-notices/domain/admin-notice.aggregate";
import type { AdminNotificationChannel } from "#api/modules/operations/admin-notices/domain/admin-notices.constants";

export class StubAdminNotifier extends AdminNotifierPort {
  readonly sent: { channel: AdminNotificationChannel; notice: AdminNoticePrimitives }[] = [];
  outcome: AdminNotifyOutcome;

  constructor(outcome: AdminNotifyOutcome = { status: "sent" }) {
    super();
    this.outcome = outcome;
  }

  async send(
    channel: AdminNotificationChannel,
    notice: AdminNoticePrimitives,
  ): Promise<AdminNotifyOutcome> {
    this.sent.push({ channel, notice });
    return this.outcome;
  }
}
