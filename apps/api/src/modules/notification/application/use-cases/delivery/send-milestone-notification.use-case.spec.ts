import type { Mocked } from "vitest";
import { vi, type MockedFunction } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { type NotificationDedupLockPort } from "../../ports/delivery/notification-dedup.port.js";
import { type NotificationHistoryReaderPort } from "../../ports/delivery/notification-history.reader.port.js";
import { NotificationPublisher } from "../../publishers/delivery/notification.publisher.js";
import { NotificationRecipientLocaleReader } from "../../readers/delivery/notification-recipient-locale.reader.js";
import { SendMilestoneNotification } from "./send-milestone-notification.use-case.js";

describe("SendMilestoneNotification", () => {
  let useCase: SendMilestoneNotification;
  let publisher: Mocked<NotificationPublisher>;
  let localeReader: Mocked<NotificationRecipientLocaleReader>;
  let history: Mocked<NotificationHistoryReaderPort>;
  let lock: Mocked<NotificationDedupLockPort>;
  let release: MockedFunction<() => Promise<void>>;

  beforeEach(async () => {
    const sendMilestoneNotificationDependencies = mockDeep<
      ConstructorParameters<typeof SendMilestoneNotification>[0]
    >({});
    const unit = new SendMilestoneNotification(sendMilestoneNotificationDependencies);
    useCase = unit;
    publisher = sendMilestoneNotificationDependencies.notificationPublisher;
    localeReader = sendMilestoneNotificationDependencies.recipientLocaleReader;
    history = sendMilestoneNotificationDependencies.notificationHistoryReader;
    lock = sendMilestoneNotificationDependencies.notificationDedupLock;
    release = vi.fn().mockResolvedValue(undefined);
    lock.acquire.mockResolvedValue(release);
    history.hasMilestoneNotification.mockResolvedValue(false);
    localeReader.getRecipientLocale.mockResolvedValue("ko");
  });

  it("milestone 잠금을 획득해 한 번 발송하고 잠금을 해제한다", async () => {
    await useCase.execute({ userId: "u1", milestone: "COUNT_10" });

    expect(lock.acquire).toHaveBeenCalledWith("milestone:u1:COUNT_10");
    expect(history.hasMilestoneNotification).toHaveBeenCalledWith("u1", "COUNT_10");
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        type: "WEEKLY_ACHIEVEMENT",
        metadata: { milestone: "COUNT_10" },
      }),
    );
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("다른 실행이 잠금을 보유하면 중복 발송을 건너뛴다", async () => {
    lock.acquire.mockResolvedValue(null);

    await useCase.execute({ userId: "u1", milestone: "COUNT_10" });

    expect(history.hasMilestoneNotification).not.toHaveBeenCalled();
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it("발송 실패 시 runtime이 재시도할 수 있도록 잠금을 해제한다", async () => {
    publisher.publish.mockRejectedValue(new Error("temporary"));

    await expect(useCase.execute({ userId: "u1", milestone: "COUNT_10" })).rejects.toThrow(
      "temporary",
    );
    expect(release).toHaveBeenCalledTimes(1);
  });
});
