import { Logger } from "@nestjs/common";

import type { NotificationChannel } from "../../application/ports/admin-notification-queue.port.js";
import type {
  AdminNotifierPort,
  AdminNotifyOutcome,
} from "../../application/ports/admin-notifier.port.js";
import type { AdminNotice } from "../../application/read-models/admin-notice.read-model.js";
import { AdminNotificationInfraEvent } from "../admin-notices-infra.log-events.js";

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
