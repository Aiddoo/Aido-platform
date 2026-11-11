import { InMemoryNotificationDedup } from "#test/doubles/notification/in-memory-notification-dedup";
import { InMemoryNotificationRepository } from "#test/doubles/notification/in-memory-notification.repository";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createInboxNotificationFixture } from "#test/fixtures/notification/notification.fixture";

import { NotificationHistoryReader } from "./notification-history.reader.js";
import type { FindAlreadyNotifiedUserIdsQuery } from "./ports/notification-history.reader.port.js";

const NOTIFICATION_DATE = Temporal.PlainDate.from("2026-03-09");

const query: FindAlreadyNotifiedUserIdsQuery = {
  userIds: ["user-1", "user-2"],
  type: "FRIEND_COMPLETED",
  notificationDate: NOTIFICATION_DATE,
  friendId: "friend-1",
};

// DB에는 user-2가 이미 오늘 같은 친구의 완료 알림을 받은 기록이 있다
function setup() {
  const notificationDedup = new InMemoryNotificationDedup();
  const notificationHistory = new InMemoryNotificationRepository([
    createInboxNotificationFixture({
      userId: "user-2",
      type: "FRIEND_COMPLETED",
      friendId: "friend-1",
      notificationDate: NOTIFICATION_DATE,
    }),
  ]);
  const reader = new NotificationHistoryReader({
    notificationDedup,
    notificationHistoryReader: notificationHistory,
    logger: new SilentLogger(),
  });
  return { reader, notificationDedup };
}

describe("NotificationHistoryReader — 이미 알림 받은 사용자 조회", () => {
  it("warm(센티넬 존재)이면 Redis 결과만 믿고 DB를 보지 않는다", async () => {
    // Given Redis에는 user-1만 기록돼 있다
    const { reader, notificationDedup } = setup();
    await notificationDedup.recordNotifiedUsers([
      { userId: "user-1", type: "FRIEND_COMPLETED", notificationDate: NOTIFICATION_DATE },
    ]);

    // When
    const result = await reader.findAlreadyNotifiedUserIds(query);

    // Then
    expect(result).toEqual(new Set(["user-1"]));
  });

  it("cold(센티넬 없음)이면 DB에서 읽고 그 결과로 Redis를 warm-up한다", async () => {
    // Given
    const { reader, notificationDedup } = setup();

    // When
    const result = await reader.findAlreadyNotifiedUserIds(query);

    // Then
    expect(result).toEqual(new Set(["user-2"]));
    expect(notificationDedup.isWarm("FRIEND_COMPLETED", NOTIFICATION_DATE)).toBe(true);
    await expect(
      notificationDedup.readKnownRecipients("FRIEND_COMPLETED", NOTIFICATION_DATE, query.userIds),
    ).resolves.toEqual(new Set(["user-2"]));
  });
});
