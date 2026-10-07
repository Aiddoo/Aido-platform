import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import type { CreateNotificationData } from "../../ports/delivery/notification-data.js";
import { type NotificationDedupLockPort } from "../../ports/delivery/notification-dedup.port.js";
import { type NotificationHistoryReaderPort } from "../../ports/delivery/notification-history.reader.port.js";
import { SendNotificationWithDedup } from "./send-notification-with-dedup.use-case.js";
import { SendNotification } from "./send-notification.use-case.js";

const followData: CreateNotificationData = {
  userId: "user-1",
  type: "FOLLOW_NEW",
  title: "t",
  body: "b",
  friendId: "friend-1",
};

const nudgeData: CreateNotificationData = {
  userId: "user-1",
  type: "NUDGE_RECEIVED",
  title: "t",
  body: "b",
  nudgeId: 1,
};

describe("SendNotificationWithDedup", () => {
  let useCase: SendNotificationWithDedup;
  let sendNotification: Mocked<SendNotification>;
  let repository: Mocked<NotificationHistoryReaderPort>;
  let dedupLock: Mocked<NotificationDedupLockPort>;
  const release = vi.fn().mockResolvedValue(undefined);

  beforeEach(async () => {
    const sendNotificationWithDedupDependencies = mockDeep<
      ConstructorParameters<typeof SendNotificationWithDedup>[0]
    >({});
    const unit = new SendNotificationWithDedup(sendNotificationWithDedupDependencies);
    useCase = unit;
    sendNotification = sendNotificationWithDedupDependencies.sendNotification;
    repository = sendNotificationWithDedupDependencies.notificationHistoryReader;
    dedupLock = sendNotificationWithDedupDependencies.dedupLock;
    dedupLock.acquire.mockResolvedValue(release);
    sendNotification.execute.mockResolvedValue(null);
  });

  it("전략 없는 타입이면 락 없이 바로 발송한다", async () => {
    await useCase.execute(nudgeData);

    expect(dedupLock.acquire).not.toHaveBeenCalled();
    expect(sendNotification.execute).toHaveBeenCalledWith(nudgeData);
  });

  it("락 경합(acquire=null) 시 null 반환하고 발송하지 않는다", async () => {
    dedupLock.acquire.mockResolvedValue(null);

    const result = await useCase.execute(followData);

    expect(result).toBeNull();
    expect(sendNotification.execute).not.toHaveBeenCalled();
  });

  it("최근 동일 알림 존재 시 skip(null) + 락 해제", async () => {
    repository.existsRecentNotification.mockResolvedValue(true);

    const result = await useCase.execute(followData);

    expect(result).toBeNull();
    expect(sendNotification.execute).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("최근 중복 없으면 발송 + 락 해제", async () => {
    repository.existsRecentNotification.mockResolvedValue(false);

    await useCase.execute(followData);

    expect(sendNotification.execute).toHaveBeenCalledWith(followData);
    expect(release).toHaveBeenCalledTimes(1);
  });
});
