import { Logger } from "@nestjs/common";

import type { NotificationChannel } from "../../../application/ports/notifications/admin-notification-queue.port.js";
import type {
  AdminNotifierPort,
  AdminNotifyOutcome,
} from "../../../application/ports/notifications/admin-notifier.port.js";
import type { AdminNotice } from "../../../application/read-models/notifications/admin-notice.read-model.js";
import { AdminNotificationInfraEvent } from "../../observability/notifications/admin-notification-infra.events.js";

/** 외부 채널 없이 발송했다는 사실만 로그로 남긴다(개발·테스트). 알림 내용은 남기지 않는다. */
export class LogAdminNotifierAdapter implements AdminNotifierPort {
  readonly #logger = new Logger(LogAdminNotifierAdapter.name);

  async send(channel: NotificationChannel, notice: AdminNotice): Promise<AdminNotifyOutcome> {
    this.#logger.debug({
      event: AdminNotificationInfraEvent.DELIVERY_SIMULATED,
      channel,
      noticeType: notice.type,
    });
    return { status: "sent" };
  }
}
