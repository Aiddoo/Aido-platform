import { InMemoryNotificationRepository } from "#test/doubles/notification/in-memory-notification.repository";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createInboxNotificationFixture } from "#test/fixtures/notification/notification.fixture";

import { ListNotificationsUseCase } from "./list-notifications.use-case.js";

const USER_ID = "user-1";

function minutesAfterBase(minutes: number): Temporal.Instant {
  return Temporal.Instant.from("2026-11-10T00:00:00Z").add({ minutes });
}

function createListNotificationsUseCase(notificationInboxReader: InMemoryNotificationRepository) {
  return new ListNotificationsUseCase({ notificationInboxReader, logger: new SilentLogger() });
}

describe("ListNotificationsUseCase — 알림 목록", () => {
  it("내 알림만 최신순으로 size만큼 주고 다음 커서를 마지막 알림 id로 준다", async () => {
    // Given
    const reader = new InMemoryNotificationRepository([
      createInboxNotificationFixture({ userId: USER_ID, id: 1, createdAt: minutesAfterBase(1) }),
      createInboxNotificationFixture({ userId: USER_ID, id: 2, createdAt: minutesAfterBase(2) }),
      createInboxNotificationFixture({ userId: USER_ID, id: 3, createdAt: minutesAfterBase(3) }),
      createInboxNotificationFixture({
        userId: "other-user",
        id: 4,
        createdAt: minutesAfterBase(4),
      }),
    ]);

    // When
    const page = await createListNotificationsUseCase(reader).execute({ userId: USER_ID, size: 2 });

    // Then
    expect(page.items.map((item) => item.id)).toEqual([3, 2]);
    expect(page.pagination).toEqual({ hasNext: true, nextCursor: 2, size: 2 });
  });

  it("커서 다음 알림부터 주고 마지막 페이지는 nextCursor가 null이다", async () => {
    // Given
    const reader = new InMemoryNotificationRepository([
      createInboxNotificationFixture({ userId: USER_ID, id: 1, createdAt: minutesAfterBase(1) }),
      createInboxNotificationFixture({ userId: USER_ID, id: 2, createdAt: minutesAfterBase(2) }),
      createInboxNotificationFixture({ userId: USER_ID, id: 3, createdAt: minutesAfterBase(3) }),
    ]);

    // When
    const page = await createListNotificationsUseCase(reader).execute({
      userId: USER_ID,
      cursor: 2,
      size: 20,
    });

    // Then
    expect(page.items.map((item) => item.id)).toEqual([1]);
    expect(page.pagination).toEqual({ hasNext: false, nextCursor: null, size: 20 });
  });

  it("unreadOnly면 읽은 알림을 뺀다", async () => {
    // Given
    const reader = new InMemoryNotificationRepository([
      createInboxNotificationFixture({
        userId: USER_ID,
        id: 1,
        isRead: true,
        readAt: Temporal.Instant.from("2026-11-10T00:00:00Z"),
      }),
      createInboxNotificationFixture({ userId: USER_ID, id: 2, isRead: false, readAt: null }),
    ]);

    // When
    const page = await createListNotificationsUseCase(reader).execute({
      userId: USER_ID,
      unreadOnly: true,
    });

    // Then
    expect(page.items.map((item) => item.id)).toEqual([2]);
  });

  it.each([
    [
      "SOCIAL",
      ["FOLLOW_NEW", "NUDGE_RECEIVED", "CHEER_RECEIVED"],
      ["SYSTEM_NOTICE", "TODO_REMINDER"],
    ],
    [
      "NOTICE",
      ["SYSTEM_NOTICE", "ADMIN_BROADCAST", "ADMIN_TARGETED"],
      ["FOLLOW_NEW", "TODO_REMINDER"],
    ],
  ] as const)("category %s는 그 분류의 타입만 준다", async (category, included, excluded) => {
    // Given
    const types = [...included, ...excluded];
    const reader = new InMemoryNotificationRepository(
      types.map((type, index) =>
        createInboxNotificationFixture({ userId: USER_ID, id: index + 1, type }),
      ),
    );

    // When
    const page = await createListNotificationsUseCase(reader).execute({
      userId: USER_ID,
      category,
      appVersion: "1.13.0",
    });

    // Then
    expect(page.items.map((item) => item.type).toSorted()).toEqual([...included].toSorted());
  });

  it("최신 앱의 전체 목록은 모든 알림 타입을 준다", async () => {
    // Given
    const reader = new InMemoryNotificationRepository([
      createInboxNotificationFixture({ userId: USER_ID, id: 1, type: "NUDGE_RECEIVED" }),
      createInboxNotificationFixture({ userId: USER_ID, id: 2, type: "NUDGE_REPLIED" }),
    ]);

    // When
    const page = await createListNotificationsUseCase(reader).execute({
      userId: USER_ID,
      category: "ALL",
      appVersion: "1.13.0",
    });

    // Then
    expect(page.items).toHaveLength(2);
  });

  it.each([undefined, "1.10.0", "1.10.1"])(
    "앱 버전 %s의 목록에서 새 알림은 페이지를 나누기 전에 뺀다",
    async (appVersion) => {
      // Given
      const reader = new InMemoryNotificationRepository([
        createInboxNotificationFixture({
          userId: USER_ID,
          id: 1,
          type: "NUDGE_RECEIVED",
          createdAt: minutesAfterBase(1),
        }),
        createInboxNotificationFixture({
          userId: USER_ID,
          id: 2,
          type: "NUDGE_REPLIED",
          createdAt: minutesAfterBase(2),
        }),
        createInboxNotificationFixture({
          userId: USER_ID,
          id: 3,
          type: "NUDGE_THANKED",
          createdAt: minutesAfterBase(3),
        }),
      ]);

      // When
      const page = await createListNotificationsUseCase(reader).execute({
        userId: USER_ID,
        appVersion,
        size: 1,
      });

      // Then
      expect(page.items.map((item) => item.type)).toEqual(["NUDGE_RECEIVED"]);
      expect(page.pagination.hasNext).toBe(false);
    },
  );
});
