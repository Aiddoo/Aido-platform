import {
  AdminNotifierPort,
  type AdminNotifyOutcome,
} from "#api/modules/operations/admin-notices/application/ports/admin-notifier.port";
import type { AdminNotice } from "#api/modules/operations/admin-notices/application/read-models/admin-notice.read-model";
import type { AdminNotificationChannel } from "#api/modules/operations/admin-notices/domain/admin-notices.constants";

export class StubAdminNotifier extends AdminNotifierPort {
  readonly sent: { channel: AdminNotificationChannel; notice: AdminNotice }[] = [];
  outcome: AdminNotifyOutcome;

  constructor(outcome: AdminNotifyOutcome = { status: "sent" }) {
    super();
    this.outcome = outcome;
  }

  async send(channel: AdminNotificationChannel, notice: AdminNotice): Promise<AdminNotifyOutcome> {
    this.sent.push({ channel, notice });
    return this.outcome;
  }
}
