import { Logger } from "@nestjs/common";
import { vi } from "vitest";

import {
  CONTRACT_NOTICE,
  describeAdminNotifierContract,
} from "../../../../../../test/contracts/operations/admin-notifier.contract.js";
import { AdminNotifierProviderLogEvent } from "./admin-notifier-provider.log-events.js";
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

  it("보내지 않고 채널과 알림 종류만 로그에 남기며 알림 내용은 남기지 않는다", async () => {
    // When
    await new LogAdminNotifierAdapter().send("payment", CONTRACT_NOTICE);

    // Then
    expect(Logger.prototype.debug).toHaveBeenCalledExactlyOnceWith({
      event: AdminNotifierProviderLogEvent.DELIVERY_SIMULATED,
      channel: "payment",
      noticeType: "message",
    });
  });
});
