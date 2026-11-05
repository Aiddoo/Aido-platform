import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";

import { OperationsAlertKey } from "../../observability/notifications/operations-alerts.js";
import { OperationsNotificationsLogEvent } from "../../observability/notifications/operations-notifications-log.events.js";
import type { NotificationChannel } from "../../ports/notifications/admin-notification-queue.port.js";
import { type AdminNotifierPort } from "../../ports/notifications/admin-notifier.port.js";
import type { AdminNotification } from "../../read-models/notifications/admin-notification.read-model.js";

export class AdminNotificationRetryableError extends Error {
  constructor(readonly channel: NotificationChannel) {
    super(`Admin notification delivery failed: ${channel}`);
    this.name = AdminNotificationRetryableError.name;
  }
}

interface SendAdminNotificationDependencies {
  readonly notifier: Pick<AdminNotifierPort, "send">;
  readonly alert: OperationalAlertPort;
  readonly logger: Pick<ApplicationLogger, "debug" | "log" | "warn">;
}

/**
 * 관리자 알림 발송 유스케이스.
 *
 * 일시 실패(재시도 가능)만 던져 큐 재시도를 맡기고, 채널 미설정은 건너뛰며,
 * 재시도해도 안 되는 거절은 운영 경보로 올린다.
 */
export class SendAdminNotification {
  readonly #dependencies: SendAdminNotificationDependencies;

  constructor(dependencies: SendAdminNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(channel: NotificationChannel, notification: AdminNotification): Promise<void> {
    this.#dependencies.logger.debug({
      event: OperationsNotificationsLogEvent.SEND_STARTED,
      channel,
    });

    const outcome = await this.#dependencies.notifier.send(channel, notification);

    if (outcome.status === "sent") {
      this.#dependencies.logger.log({
        event: OperationsNotificationsLogEvent.SEND_COMPLETED,
        channel,
      });
      return;
    }
    if (outcome.status === "skipped") {
      this.#dependencies.logger.debug({
        event: OperationsNotificationsLogEvent.SEND_SKIPPED,
        channel,
        reason: outcome.reason,
      });
      return;
    }
    if (outcome.retryable) {
      throw new AdminNotificationRetryableError(channel);
    }

    this.#dependencies.logger.warn({
      event: OperationsNotificationsLogEvent.SEND_REJECTED,
      channel,
      statusCode: outcome.statusCode,
    });
    this.#dependencies.alert.raise({
      key: OperationsAlertKey.ADMIN_NOTIFICATION_REJECTED,
      severity: "warning",
      message: "관리자 알림이 채널에서 거절되었습니다",
      tags: { channel },
      details: { statusCode: outcome.statusCode ?? null },
    });
  }
}
