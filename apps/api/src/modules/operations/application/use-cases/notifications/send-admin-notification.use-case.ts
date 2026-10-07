import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import type { AdminNotification } from "../../../domain/value-objects/notifications/admin-notification-message.vo.js";
import type { NotificationChannel } from "../../ports/notifications/admin-notification-queue.port.js";
import { type AdminNotifier } from "../../ports/notifications/admin-notifier.port.js";

/**
 * 관리자 알림 발송 유스케이스.
 *
 * 채널에 따라 관리자/결제 Discord 프로바이더를 선택해 발송한다.
 * 발송 실패 시 예외를 던져 BullMQ 재시도를 트리거한다.
 */
interface SendAdminNotificationDependencies {
  readonly adminNotifier: AdminNotifier;
  readonly paymentNotifier: AdminNotifier;
  readonly logger: ApplicationLogger;
}

export class SendAdminNotification {
  readonly #dependencies: SendAdminNotificationDependencies;

  constructor(dependencies: SendAdminNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(channel: NotificationChannel, notification: AdminNotification): Promise<void> {
    const notifier =
      channel === "payment" ? this.#dependencies.paymentNotifier : this.#dependencies.adminNotifier;

    this.#dependencies.logger.debug(
      `Processing admin notification: channel=${channel}, title=${notification.title}`,
    );

    const result = await notifier.send(notification);

    if (!result.success) {
      throw new Error(`Discord webhook failed: ${result.error}`);
    }

    this.#dependencies.logger.log(
      `Admin notification sent: channel=${channel}, title=${notification.title}`,
    );
  }
}
