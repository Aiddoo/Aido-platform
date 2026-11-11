import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";

import type { AdminNotificationChannel } from "../../domain/admin-notices.constants.js";
import { AdminNoticeAlerts } from "../admin-notices.alerts.js";
import { adminNotificationRetryable } from "../admin-notices.errors.js";
import { AdminNoticeLogEvent } from "../admin-notices.log-events.js";
import type { AdminNotifierPort } from "../ports/admin-notifier.port.js";
import type { AdminNotice } from "../read-models/admin-notice.read-model.js";

export interface SendAdminNotificationCommand {
  readonly channel: AdminNotificationChannel;
  readonly notice: AdminNotice;
}

export interface SendAdminNotificationDependencies {
  readonly notifier: Pick<AdminNotifierPort, "send">;
  readonly alert: Pick<OperationalAlertPort, "raise">;
  readonly logger: Pick<ApplicationLoggerPort, "debug" | "log" | "warn">;
}

/**
 * 일시 실패(재시도 가능)만 던져 큐 재시도를 맡기고, 채널 미설정은 건너뛰며,
 * 재시도해도 안 되는 거절은 운영 경보로 올린다.
 */
export class SendAdminNotificationUseCase {
  readonly #dependencies: SendAdminNotificationDependencies;

  constructor(dependencies: SendAdminNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: SendAdminNotificationCommand): Promise<void> {
    const { notifier, alert, logger } = this.#dependencies;
    const { channel, notice } = command;
    logger.debug({ event: AdminNoticeLogEvent.SEND_STARTED, channel, noticeType: notice.type });

    const outcome = await notifier.send(channel, notice);

    if (outcome.status === "sent") {
      logger.log({ event: AdminNoticeLogEvent.SEND_COMPLETED, channel, noticeType: notice.type });
      return;
    }
    if (outcome.status === "skipped") {
      logger.debug({
        event: AdminNoticeLogEvent.SEND_SKIPPED,
        channel,
        reason: outcome.reason,
      });
      return;
    }
    if (outcome.retryable) {
      throw adminNotificationRetryable(channel);
    }

    logger.warn({
      event: AdminNoticeLogEvent.SEND_REJECTED,
      channel,
      statusCode: outcome.statusCode,
    });
    alert.raise({
      ...AdminNoticeAlerts.ADMIN_NOTIFICATION_REJECTED,
      tags: { channel },
      details: { statusCode: outcome.statusCode ?? null },
    });
  }
}
