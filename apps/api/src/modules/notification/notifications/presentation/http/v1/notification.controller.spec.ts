import type { CurrentUserPayload } from "#api/modules/identity/identity-auth-http.public";
import { InMemoryNotificationRepository } from "#test/doubles/notification/in-memory-notification.repository";
import { PassThroughNotificationCache } from "#test/doubles/notification/pass-through-notification-cache";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createInboxNotificationFixture } from "#test/fixtures/notification/notification.fixture";

import { GetUnreadNotificationCountUseCase } from "../../../application/use-cases/get-unread-notification-count.use-case.js";
import { ListNotificationsUseCase } from "../../../application/use-cases/list-notifications.use-case.js";
import { MarkAllNotificationsReadUseCase } from "../../../application/use-cases/mark-all-notifications-read.use-case.js";
import { MarkNotificationOpenedUseCase } from "../../../application/use-cases/mark-notification-opened.use-case.js";
import { MarkNotificationReadUseCase } from "../../../application/use-cases/mark-notification-read.use-case.js";
import { NotificationController } from "./notification.controller.js";

const USER: CurrentUserPayload = {
  userId: "user-123",
  email: "test@example.com",
  sessionId: "session-123",
  role: "USER",
};
const NOW = Temporal.Instant.from("2026-11-10T09:00:00Z");

function createNotificationController(repository: InMemoryNotificationRepository) {
  const cache = new PassThroughNotificationCache();
  const clock = new FixedClock(NOW);
  const logger = new SilentLogger();
  return new NotificationController(
    new ListNotificationsUseCase({ notificationInboxReader: repository, logger }),
    new GetUnreadNotificationCountUseCase({ notificationInboxReader: repository, cache }),
    new MarkNotificationReadUseCase({ notificationRepository: repository, cache, clock, logger }),
    new MarkNotificationOpenedUseCase({ notificationRepository: repository, cache, clock, logger }),
    new MarkAllNotificationsReadUseCase({
      notificationRepository: repository,
      cache,
      clock,
      logger,
    }),
  );
}

describe("NotificationController — 알림 컨트롤러", () => {
  it("읽지 않은 알림 수를 준다", async () => {
    // Given
    const repository = new InMemoryNotificationRepository(
      Array.from({ length: 5 }, (_, index) =>
        createInboxNotificationFixture({ id: index + 1, userId: USER.userId }),
      ),
    );
    const controller = createNotificationController(repository);

    // When
    const result = await controller.getUnreadCount(USER);

    // Then
    expect(result).toEqual({ unreadCount: 5 });
  });

  it("읽지 않은 알림이 없으면 0을 준다", async () => {
    // Given
    const controller = createNotificationController(new InMemoryNotificationRepository());

    // When
    const result = await controller.getUnreadCount(USER);

    // Then
    expect(result).toEqual({ unreadCount: 0 });
  });

  it("단일 알림을 읽음 처리하고 계약 문구와 1건을 준다", async () => {
    // Given
    const repository = new InMemoryNotificationRepository([
      createInboxNotificationFixture({ userId: USER.userId, id: 42, isRead: false, readAt: null }),
    ]);
    const controller = createNotificationController(repository);

    // When
    const result = await controller.markAsRead(USER, { id: 42 });

    // Then
    expect(result).toEqual({ message: "알림을 읽음 처리했습니다.", readCount: 1 });
    expect(repository.rowOf(42)?.isRead).toBe(true);
  });

  it("모든 알림을 읽음 처리하고 계약 문구와 처리한 개수를 준다", async () => {
    // Given
    const repository = new InMemoryNotificationRepository(
      Array.from({ length: 3 }, (_, index) =>
        createInboxNotificationFixture({ id: index + 1, userId: USER.userId }),
      ),
    );
    const controller = createNotificationController(repository);

    // When
    const result = await controller.markAllAsRead(USER);

    // Then
    expect(result).toEqual({ message: "모든 알림을 읽음 처리했습니다.", readCount: 3 });
  });
});
