import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import type { AdminNotification } from "../../read-models/notifications/admin-notification.read-model.js";
import { SendAdminNotification } from "./send-admin-notification.use-case.js";

describe("SendAdminNotification", () => {
  let useCase: SendAdminNotification;
  let adminNotifier: Mocked<
    ConstructorParameters<typeof SendAdminNotification>[0]["adminNotifier"]
  >;
  let paymentNotifier: Mocked<
    ConstructorParameters<typeof SendAdminNotification>[0]["paymentNotifier"]
  >;

  let logger: Mocked<ConstructorParameters<typeof SendAdminNotification>[0]["logger"]>;

  const notification: AdminNotification = {
    title: "synthetic-private-admin-title",
    body: "synthetic-private-admin-body",
  };

  beforeEach(async () => {
    const sendAdminNotificationDependencies = mockDeep<
      ConstructorParameters<typeof SendAdminNotification>[0]
    >({});
    const unit = new SendAdminNotification(sendAdminNotificationDependencies);
    logger = sendAdminNotificationDependencies.logger;
    useCase = unit;
    adminNotifier = sendAdminNotificationDependencies.adminNotifier;
    paymentNotifier = sendAdminNotificationDependencies.paymentNotifier;
    adminNotifier.send.mockResolvedValue({ success: true });
    paymentNotifier.send.mockResolvedValue({ success: true });
  });

  it("admin 채널 → ADMIN_NOTIFIER로 발송해야 한다", async () => {
    await useCase.execute("admin", notification);

    expect(adminNotifier.send).toHaveBeenCalledWith(notification);
    expect(paymentNotifier.send).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify([logger.debug.mock.calls, logger.log.mock.calls]);
    expect(logged).not.toContain(notification.title);
    expect(logged).not.toContain(notification.body);
  });

  it("payment 채널 → PAYMENT_NOTIFIER로 발송해야 한다", async () => {
    await useCase.execute("payment", notification);

    expect(paymentNotifier.send).toHaveBeenCalledWith(notification);
    expect(adminNotifier.send).not.toHaveBeenCalled();
  });

  it("send 실패 시 Error를 throw해야 한다 (BullMQ 재시도 트리거)", async () => {
    adminNotifier.send.mockResolvedValue({
      success: false,
      error: "Webhook 404",
    });

    await expect(useCase.execute("admin", notification)).rejects.toThrow(
      "Discord webhook failed: Webhook 404",
    );
  });
});
