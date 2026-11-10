import { RecordingOperationalAlert } from "#test/mocks/recording-operational-alert";

import type { NotificationChannel } from "../ports/admin-notification-queue.port.js";
import type { AdminNotifyOutcome } from "../ports/admin-notifier.port.js";
import type { AdminNotice } from "../read-models/admin-notice.read-model.js";
import {
  AdminNotificationRetryableError,
  SendAdminNotification,
} from "./send-admin-notification.use-case.js";

const notification: AdminNotice = {
  type: "subscription_event",
  user: {
    userId: "user-1",
    email: "synthetic-private-admin@example.com",
    nickname: "synthetic-private-admin-name",
  },
  subscription: { event: "purchased", price: { usd: 1 } },
};

class StubNotifier {
  readonly sent: { channel: NotificationChannel; notification: AdminNotice }[] = [];

  readonly #outcome: AdminNotifyOutcome;

  constructor(outcome: AdminNotifyOutcome) {
    this.#outcome = outcome;
  }

  async send(channel: NotificationChannel, sentNotification: AdminNotice) {
    this.sent.push({ channel, notification: sentNotification });
    return this.#outcome;
  }
}

class RecordingLogger {
  readonly entries: unknown[] = [];

  debug(entry: unknown): void {
    this.entries.push(entry);
  }

  log(entry: unknown): void {
    this.entries.push(entry);
  }

  warn(entry: unknown): void {
    this.entries.push(entry);
  }
}

function setup(outcome: AdminNotifyOutcome) {
  const notifier = new StubNotifier(outcome);
  const alert = new RecordingOperationalAlert();
  const logger = new RecordingLogger();
  const useCase = new SendAdminNotification({ notifier, alert, logger });
  return { useCase, notifier, alert, logger };
}

describe("SendAdminNotification", () => {
  it.each(["admin", "payment"] as const)(
    "%s 채널로 포트에 그대로 넘기고 내용은 로그에 남기지 않는다",
    async (channel) => {
      // Given
      const { useCase, notifier, alert, logger } = setup({ status: "sent" });

      // When
      await useCase.execute(channel, notification);

      // Then
      expect(notifier.sent).toEqual([{ channel, notification }]);
      expect(alert.alerts).toEqual([]);
      const logged = JSON.stringify(logger.entries);
      expect(logged).not.toContain("synthetic-private");
      expect(logged).toContain("subscription_event");
    },
  );

  it("채널이 설정되지 않아 건너뛰면 던지지도 경보를 올리지도 않는다", async () => {
    // Given
    const { useCase, alert } = setup({ status: "skipped", reason: "not_configured" });

    // When
    const execution = useCase.execute("admin", notification);

    // Then
    await expect(execution).resolves.toBeUndefined();
    expect(alert.alerts).toEqual([]);
  });

  it("재시도 가능한 실패는 던져서 큐가 다시 시도하게 한다", async () => {
    // Given
    const { useCase, alert } = setup({ status: "failed", retryable: true, statusCode: 503 });

    // When
    const execution = useCase.execute("admin", notification);

    // Then
    await expect(execution).rejects.toBeInstanceOf(AdminNotificationRetryableError);
    expect(alert.alerts).toEqual([]);
  });

  it("재시도해도 소용없는 거절은 던지지 않고 운영 경보를 한 번 올린다", async () => {
    // Given
    const { useCase, alert } = setup({ status: "failed", retryable: false, statusCode: 404 });

    // When
    await useCase.execute("payment", notification);

    // Then
    expect(alert.alerts).toEqual([
      expect.objectContaining({
        key: "operations.admin-notification.rejected",
        severity: "warning",
        tags: { channel: "payment" },
        details: { statusCode: 404 },
      }),
    ]);
  });
});
