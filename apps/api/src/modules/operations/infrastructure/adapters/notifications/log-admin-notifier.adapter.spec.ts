import { Logger } from "@nestjs/common";
import { vi } from "vitest";

import { AdminNotificationInfraEvent } from "../../observability/notifications/admin-notification-infra.events.js";
import { CONTRACT_NOTIFICATION, describeAdminNotifierContract } from "./admin-notifier.contract.js";
import { LogAdminNotifierAdapter } from "./log-admin-notifier.adapter.js";

describe("LogAdminNotifierAdapter", () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, "debug").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describeAdminNotifierContract({
    scenarios: ["sent"],
    arrange: () => new LogAdminNotifierAdapter(),
  });

  it("보내지 않고 채널과 등급만 로그에 남기며 알림 내용은 남기지 않는다", async () => {
    // When
    await new LogAdminNotifierAdapter().send("payment", CONTRACT_NOTIFICATION);

    // Then
    expect(Logger.prototype.debug).toHaveBeenCalledExactlyOnceWith({
      event: AdminNotificationInfraEvent.DELIVERY_SIMULATED,
      channel: "payment",
      severity: "warning",
    });
  });
});
