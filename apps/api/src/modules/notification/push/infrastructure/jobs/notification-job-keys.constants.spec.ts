import {
  notificationEventJobKey,
  pushDeliveryJobKey,
  todoReminderJobKey,
} from "./notification-job-keys.constants.js";
import { NotificationJobName } from "./notification.queue.js";

describe("알림 작업 key", () => {
  const occurredAt = new Date("2026-11-03T15:30:00.000Z");

  it("원인 이벤트를 가리키는 key를 만든다", () => {
    // When
    const keys = [
      notificationEventJobKey(
        {
          name: NotificationJobName.FOLLOW_NEW,
          data: { followerId: "a", followingId: "b", followerName: "A" },
        },
        occurredAt,
      ),
      notificationEventJobKey(
        {
          name: NotificationJobName.FOLLOW_MUTUAL,
          data: { userId: "b", friendId: "a", friendName: "A" },
        },
        occurredAt,
      ),
      notificationEventJobKey(
        {
          name: NotificationJobName.MILESTONE_REACHED,
          data: { userId: "a", milestone: "COUNT_10" },
        },
        occurredAt,
      ),
      notificationEventJobKey(
        { name: NotificationJobName.BILLING_ISSUE, data: { userId: "a" } },
        occurredAt,
      ),
    ];

    // Then
    // 같은 이벤트는 같은 key, 다른 이벤트·수신자는 다른 key다
    expect(keys).toEqual([
      "follow-new-a-b",
      "follow-mutual-b-a",
      "milestone-a-COUNT_10",
      "billing-issue-a-2026-11-03",
    ]);
  });

  it("친구 완료 key는 친구의 현지 날짜로 하루에 하나다", () => {
    // Given
    const job = {
      name: NotificationJobName.FRIEND_COMPLETED,
      data: { friendId: "f", friendName: "F", notifyUserIds: ["u"], timezone: "Asia/Seoul" },
    };

    // When
    const afterSeoulMidnight = notificationEventJobKey(job, occurredAt);
    const beforeSeoulMidnight = notificationEventJobKey(job, new Date("2026-11-03T14:59:00.000Z"));

    // Then
    // UTC 15:30은 서울 다음 날 00:30이다
    expect(afterSeoulMidnight).toBe("friend-completed-f-2026-11-04");
    expect(beforeSeoulMidnight).toBe("friend-completed-f-2026-11-03");
  });

  it("delivery key는 publication 순서와 무관하고 generation이 바뀌면 달라진다", () => {
    // Given
    const publications = [
      { dispatchId: 2, publishAttempt: 1 },
      { dispatchId: 1, publishAttempt: 3 },
    ];

    // When
    const key = pushDeliveryJobKey(publications);
    const reversedKey = pushDeliveryJobKey([...publications].reverse());
    const otherGenerationKey = pushDeliveryJobKey([
      { dispatchId: 2, publishAttempt: 2 },
      { dispatchId: 1, publishAttempt: 3 },
    ]);

    // Then
    expect(key).toBe(reversedKey);
    expect(key).not.toBe(otherGenerationKey);
    expect(key).toMatch(/^push-delivery-[0-9a-f]{64}$/);
  });

  it("리마인더 key는 이전 배포가 예약한 작업을 취소할 수 있도록 형식을 유지한다", () => {
    // When
    const key = todoReminderJobKey(42, "10min");

    // Then
    expect(key).toBe("reminder_42_10min");
  });
});
