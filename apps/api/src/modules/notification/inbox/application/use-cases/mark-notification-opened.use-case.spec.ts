import { InMemoryNotificationRepository } from "#test/doubles/notification/in-memory-notification.repository";
import { PassThroughNotificationCache } from "#test/doubles/notification/pass-through-notification-cache";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createInboxNotificationFixture } from "#test/fixtures/notification/notification.fixture";

import {
  type MarkNotificationOpenedDependencies,
  MarkNotificationOpenedUseCase,
} from "./mark-notification-opened.use-case.js";

const USER_ID = "user-1";
const NOW = Temporal.Instant.from("2026-11-10T09:00:00Z");

function createMarkNotificationOpenedUseCase(
  overrides: Partial<MarkNotificationOpenedDependencies> = {},
) {
  return new MarkNotificationOpenedUseCase({
    notificationRepository: new InMemoryNotificationRepository(),
    cache: new PassThroughNotificationCache(),
    clock: new FixedClock(NOW),
    logger: new SilentLogger(),
    ...overrides,
  });
}

describe("MarkNotificationOpenedUseCase — 푸시 열기 기록", () => {
  it("처음 열면 열린 시각과 읽음을 기록하고 미읽음 캐시를 비운 뒤 true를 준다", async () => {
    // Given
    const notification = createInboxNotificationFixture({
      userId: USER_ID,
      id: 42,
      isRead: false,
      readAt: null,
    });
    const notificationRepository = new InMemoryNotificationRepository([notification]);
    const cache = new PassThroughNotificationCache();
    const useCase = createMarkNotificationOpenedUseCase({ notificationRepository, cache });

    // When
    const result = await useCase.execute({ userId: USER_ID, notificationId: 42 });

    // Then
    const openedAt = NOW;
    expect(result).toBe(true);
    expect(notificationRepository.rowOf(42)).toMatchObject({
      openedAt,
      isRead: true,
      readAt: openedAt,
    });
    expect(cache.invalidatedUnreadCountUserIds).toEqual([USER_ID]);
  });

  it.each([
    ["이미 연 알림", createInboxNotificationFixture({ userId: USER_ID, id: 42 }), true],
    ["남의 알림", createInboxNotificationFixture({ userId: "other-user", id: 42 }), false],
  ])("%s은 캐시를 두고 false를 준다", async (_case, notification, isOpened) => {
    // Given
    const row = isOpened
      ? { ...notification, openedAt: Temporal.Instant.from("2026-11-01T00:00:00Z") }
      : notification;
    const notificationRepository = new InMemoryNotificationRepository([row]);
    const cache = new PassThroughNotificationCache();
    const useCase = createMarkNotificationOpenedUseCase({ notificationRepository, cache });

    // When
    const result = await useCase.execute({ userId: USER_ID, notificationId: 42 });

    // Then
    expect(result).toBe(false);
    expect(notificationRepository.rowOf(42)).toEqual(row);
    expect(cache.invalidatedUnreadCountUserIds).toEqual([]);
  });

  it("같은 알림을 두 번 열어도 열림 로그는 처음 한 번만 남긴다", async () => {
    // Given
    const notificationRepository = new InMemoryNotificationRepository([
      createInboxNotificationFixture({ userId: USER_ID, id: 42, isRead: false, readAt: null }),
    ]);
    const logger = new SilentLogger();
    const useCase = createMarkNotificationOpenedUseCase({ notificationRepository, logger });
    await useCase.execute({ userId: USER_ID, notificationId: 42 });

    // When
    await useCase.execute({ userId: USER_ID, notificationId: 42 });

    // Then
    expect(logger.messages).toEqual([
      { event: "notification.push.opened", userId: USER_ID, notificationId: 42 },
    ]);
  });

  it("없는 알림도 오류 없이 false를 준다", async () => {
    // Given
    const useCase = createMarkNotificationOpenedUseCase();

    // When
    const result = await useCase.execute({ userId: USER_ID, notificationId: 999 });

    // Then
    expect(result).toBe(false);
  });
});
