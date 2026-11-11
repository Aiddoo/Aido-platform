import { InMemoryNotificationRepository } from "#test/doubles/notification/in-memory-notification.repository";
import { PassThroughNotificationCache } from "#test/doubles/notification/pass-through-notification-cache";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createInboxNotificationFixture } from "#test/fixtures/notification/notification.fixture";

import { MarkAllNotificationsReadUseCase } from "./mark-all-notifications-read.use-case.js";

const USER_ID = "user-1";
const NOW = Temporal.Instant.from("2026-11-10T09:00:00Z");

function seedNotifications() {
  return [
    createInboxNotificationFixture({ userId: USER_ID, id: 1, type: "NUDGE_RECEIVED" }),
    createInboxNotificationFixture({ userId: USER_ID, id: 2, type: "NUDGE_REPLIED" }),
    createInboxNotificationFixture({ userId: USER_ID, id: 3, type: "NUDGE_THANKED" }),
    createInboxNotificationFixture({ userId: "other-user", id: 4 }),
  ];
}

describe("MarkAllNotificationsReadUseCase — 모든 알림 읽음", () => {
  it("최신 앱은 내 미읽음 알림을 모두 읽음 처리하고 미읽음 캐시를 비운다", async () => {
    // Given
    const notificationRepository = new InMemoryNotificationRepository(seedNotifications());
    const cache = new PassThroughNotificationCache();
    const useCase = new MarkAllNotificationsReadUseCase({
      notificationRepository,
      cache,
      clock: new FixedClock(NOW),
      logger: new SilentLogger(),
    });

    // When
    const result = await useCase.execute({ userId: USER_ID, appVersion: "1.13.0" });

    // Then
    expect(result.count).toBe(3);
    expect(notificationRepository.rowOf(2)).toMatchObject({
      isRead: true,
      readAt: NOW,
    });
    expect(notificationRepository.rowOf(4)?.isRead).toBe(false);
    expect(cache.invalidatedUnreadCountUserIds).toEqual([USER_ID]);
  });

  it("기존 앱은 표시할 수 있는 알림만 읽음 처리하고 답장·감사 알림은 미읽음으로 둔다", async () => {
    // Given
    const notificationRepository = new InMemoryNotificationRepository(seedNotifications());
    const cache = new PassThroughNotificationCache();
    const useCase = new MarkAllNotificationsReadUseCase({
      notificationRepository,
      cache,
      clock: new FixedClock(NOW),
      logger: new SilentLogger(),
    });

    // When
    const result = await useCase.execute({ userId: USER_ID, appVersion: "1.10.1" });

    // Then
    expect(result.count).toBe(1);
    expect(notificationRepository.rowOf(1)?.isRead).toBe(true);
    expect(notificationRepository.rowOf(2)?.isRead).toBe(false);
    expect(notificationRepository.rowOf(3)?.isRead).toBe(false);
    expect(cache.invalidatedUnreadCountUserIds).toEqual([USER_ID]);
  });
});
