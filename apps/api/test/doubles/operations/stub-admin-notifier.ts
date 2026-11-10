import type { NotificationChannel } from "#api/modules/operations/admin-notices/application/ports/admin-notification-queue.port";
import {
  AdminNotifierPort,
  type AdminNotifyOutcome,
} from "#api/modules/operations/admin-notices/application/ports/admin-notifier.port";
import type { AdminNotice } from "#api/modules/operations/admin-notices/application/read-models/admin-notice.read-model";

export class StubAdminNotifier extends AdminNotifierPort {
  readonly sent: { channel: NotificationChannel; notice: AdminNotice }[] = [];
  outcome: AdminNotifyOutcome;

  constructor(outcome: AdminNotifyOutcome = { status: "sent" }) {
    super();
    this.outcome = outcome;
  }

  async send(channel: NotificationChannel, notice: AdminNotice): Promise<AdminNotifyOutcome> {
    this.sent.push({ channel, notice });
    return this.outcome;
  }
}
