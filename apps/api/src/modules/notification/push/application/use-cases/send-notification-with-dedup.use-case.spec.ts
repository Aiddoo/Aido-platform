import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { DateClock } from "#test/doubles/platform/date-clock";

import type { CreateNotificationData } from "../../../inbox/application/ports/notification-draft.port.js";
import { SendNotificationWithDedupUseCase } from "./send-notification-with-dedup.use-case.js";

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

describe("SendNotificationWithDedupUseCase", () => {
  let useCase: SendNotificationWithDedupUseCase;
  let sendNotification: Mocked<
    ConstructorParameters<typeof SendNotificationWithDedupUseCase>[0]["sendNotification"]
  >;
  let repository: Mocked<
    ConstructorParameters<typeof SendNotificationWithDedupUseCase>[0]["notificationHistoryReader"]
  >;
  let dedupLock: Mocked<
    ConstructorParameters<typeof SendNotificationWithDedupUseCase>[0]["dedupLock"]
  >;
  const release = vi.fn().mockResolvedValue(undefined);

  beforeEach(async () => {
    const sendNotificationWithDedupDependencies = mockDeep<
      ConstructorParameters<typeof SendNotificationWithDedupUseCase>[0]
    >({ clock: new DateClock() });
    const unit = new SendNotificationWithDedupUseCase(sendNotificationWithDedupDependencies);
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
