import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import type { AdminNotification } from "../../../domain/value-objects/notifications/admin-notification-message.vo.js";
import { type AdminNotifier } from "../../ports/notifications/admin-notifier.port.js";
import { SendAdminNotification } from "./send-admin-notification.use-case.js";

describe("SendAdminNotification", () => {
  let useCase: SendAdminNotification;
  let adminNotifier: Mocked<AdminNotifier>;
  let paymentNotifier: Mocked<AdminNotifier>;

  const notification: AdminNotification = { title: "테스트", body: "내용" };

  beforeEach(async () => {
    const sendAdminNotificationDependencies = mockDeep<
      ConstructorParameters<typeof SendAdminNotification>[0]
    >({});
    const unit = new SendAdminNotification(sendAdminNotificationDependencies);
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
