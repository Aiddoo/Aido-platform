import { ErrorCode } from "@aido/api/errors";

import { InMemoryNotificationRepository } from "#test/doubles/notification/in-memory-notification.repository";
import { PassThroughNotificationCache } from "#test/doubles/notification/pass-through-notification-cache";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createInboxNotificationFixture } from "#test/fixtures/notification/notification.fixture";

import {
  type MarkNotificationReadDependencies,
  MarkNotificationReadUseCase,
} from "./mark-notification-read.use-case.js";

const USER_ID = "user-1";
const NOW = Temporal.Instant.from("2026-11-10T09:00:00Z");

function createMarkNotificationReadUseCase(
  overrides: Partial<MarkNotificationReadDependencies> = {},
) {
  return new MarkNotificationReadUseCase({
    notificationRepository: new InMemoryNotificationRepository(),
    cache: new PassThroughNotificationCache(),
    clock: new FixedClock(NOW),
    logger: new SilentLogger(),
    ...overrides,
  });
}

describe("MarkNotificationReadUseCase — 단일 알림 읽음", () => {
  it("소유한 미읽음 알림을 지금 시각으로 읽음 처리하고 미읽음 캐시를 비운다", async () => {
    // Given
    const notification = createInboxNotificationFixture({
      userId: USER_ID,
      id: 1,
      isRead: false,
      readAt: null,
    });
    const notificationRepository = new InMemoryNotificationRepository([notification]);
    const cache = new PassThroughNotificationCache();
    const useCase = createMarkNotificationReadUseCase({ notificationRepository, cache });

    // When
    await useCase.execute({ userId: USER_ID, notificationId: 1 });

    // Then
    expect(notificationRepository.rowOf(1)).toMatchObject({
      isRead: true,
      readAt: NOW,
    });
    expect(cache.invalidatedUnreadCountUserIds).toEqual([USER_ID]);
  });

  it("알림이 없으면 NOTIFICATION_1004로 거절한다", async () => {
    // Given
    const cache = new PassThroughNotificationCache();
    const useCase = createMarkNotificationReadUseCase({ cache });

    // When
    const result = useCase.execute({ userId: USER_ID, notificationId: 999 });

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.NOTIFICATION_1004,
      details: { notificationId: 999 },
    });
    expect(cache.invalidatedUnreadCountUserIds).toEqual([]);
  });

  it.each([false, true])(
    "남의 알림은 읽음 여부(%s)와 상관없이 NOTIFICATION_1005로 거절하고 그대로 둔다",
    async (isRead) => {
      // Given
      const notification = createInboxNotificationFixture({
        userId: "other-user",
        id: 1,
        isRead,
        readAt: isRead ? Temporal.Instant.from("2026-11-01T00:00:00Z") : null,
      });
      const notificationRepository = new InMemoryNotificationRepository([notification]);
      const useCase = createMarkNotificationReadUseCase({ notificationRepository });

      // When
      const result = useCase.execute({ userId: USER_ID, notificationId: 1 });

      // Then
      await expect(result).rejects.toMatchObject({
        errorCode: ErrorCode.NOTIFICATION_1005,
        details: { notificationId: 1 },
      });
      expect(notificationRepository.rowOf(1)).toEqual(notification);
    },
  );

  it("이미 읽은 알림은 읽은 시각과 캐시를 그대로 둔다", async () => {
    // Given
    const notification = createInboxNotificationFixture({
      userId: USER_ID,
      id: 1,
      isRead: true,
      readAt: Temporal.Instant.from("2026-11-01T00:00:00Z"),
    });
    const notificationRepository = new InMemoryNotificationRepository([notification]);
    const cache = new PassThroughNotificationCache();
    const useCase = createMarkNotificationReadUseCase({ notificationRepository, cache });

    // When
    await useCase.execute({ userId: USER_ID, notificationId: 1 });

    // Then
    expect(notificationRepository.rowOf(1)).toEqual(notification);
    expect(cache.invalidatedUnreadCountUserIds).toEqual([]);
  });
});
