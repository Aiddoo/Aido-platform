import { ErrorCode } from "@aido/api/errors";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { Notification, type NotificationPrimitives } from "./notification.aggregate.js";

const OWNER = UserId.reconstitute("owner");
const OTHER = UserId.reconstitute("other");
const CREATED_AT = Temporal.Instant.from("2026-11-01T00:00:00Z");
const NOW = Temporal.Instant.from("2026-11-10T09:00:00Z");

function createNotification(overrides: Partial<NotificationPrimitives> = {}): Notification {
  return Notification.reconstitute({
    id: 4,
    userId: OWNER.value,
    type: "FOLLOW_NEW",
    title: "새 친구 요청",
    body: "수락하면 서로의 할 일을 볼 수 있어요",
    copyKey: null,
    copyFacts: null,
    isRead: false,
    readAt: null,
    openedAt: null,
    createdAt: CREATED_AT,
    ...overrides,
  });
}

describe("Notification — 읽음 전이", () => {
  it("미읽음 알림을 주인이 읽으면 지금 시각으로 읽음이 되고 true를 준다", () => {
    // Given
    const notification = createNotification();

    // When
    const isChanged = notification.markRead(OWNER, NOW);

    // Then
    expect(isChanged).toBe(true);
    expect(notification.toPrimitives()).toMatchObject({ isRead: true, readAt: NOW });
  });

  it("이미 읽었으면 false를 주고 읽은 시각을 그대로 둔다", () => {
    // Given
    const notification = createNotification({ isRead: true, readAt: CREATED_AT });

    // When
    const isChanged = notification.markRead(OWNER, NOW);

    // Then
    expect(isChanged).toBe(false);
    expect(notification.readAt).toEqual(CREATED_AT);
  });

  it("이미 읽었어도 다른 사용자의 요청은 NOTIFICATION_1005로 막는다", () => {
    // Given
    const notification = createNotification({ isRead: true, readAt: CREATED_AT });

    // When
    const markRead = () => notification.markRead(OTHER, NOW);

    // Then
    expect(markRead).toThrow(
      expect.objectContaining({
        errorCode: ErrorCode.NOTIFICATION_1005,
        details: { notificationId: 4 },
      }),
    );
  });

  it("복원한 뒤 원본 primitives를 바꿔도 전이는 복원 당시 상태를 기준으로 한 번만 일어난다", () => {
    // Given
    const primitives = { ...createNotification().toPrimitives() };
    const notification = Notification.reconstitute(primitives);

    // When
    const first = notification.markRead(OWNER, NOW);
    const second = notification.markRead(OWNER, NOW);

    // Then
    expect([first, second]).toEqual([true, false]);
    expect(primitives.isRead).toBe(false);
  });
});
