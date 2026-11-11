import { InMemoryNotificationDedupLock } from "#test/doubles/notification/in-memory-notification-dedup-lock";
import { InMemoryNotificationRepository } from "#test/doubles/notification/in-memory-notification.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  createInboxNotificationFixture,
  createNotificationDraftFixture,
  NOTIFICATION_FIXTURE_NOW,
  NOTIFICATION_FIXTURE_USER_ID,
} from "#test/fixtures/notification/notification.fixture";

import type { CreateNotificationData } from "../../../inbox/application/ports/notification-draft.port.js";
import type { InboxNotification } from "../../../inbox/application/read-models/inbox-notification.read-model.js";
import { SendNotificationWithDedupUseCase } from "./send-notification-with-dedup.use-case.js";
import type { SendNotificationUseCase } from "./send-notification.use-case.js";

const FOLLOW_DEDUP_KEY = `dedup:${NOTIFICATION_FIXTURE_USER_ID}:FOLLOW_NEW:friendId:friend-1`;

const followData = createNotificationDraftFixture({ type: "FOLLOW_NEW", friendId: "friend-1" });
const nudgeData = createNotificationDraftFixture({ type: "NUDGE_RECEIVED", nudgeId: 1 });

class RecordingSendNotification implements Pick<SendNotificationUseCase, "execute"> {
  readonly sent: CreateNotificationData[] = [];

  async execute(data: CreateNotificationData): Promise<InboxNotification | null> {
    this.sent.push(data);
    return null;
  }
}

function setup(history: readonly InboxNotification[] = []) {
  const sendNotification = new RecordingSendNotification();
  const dedupLock = new InMemoryNotificationDedupLock();
  const useCase = new SendNotificationWithDedupUseCase({
    sendNotification,
    dedupLock,
    notificationHistoryReader: new InMemoryNotificationRepository(history),
    clock: new FixedClock(NOTIFICATION_FIXTURE_NOW),
    logger: new SilentLogger(),
  });
  return { useCase, sendNotification, dedupLock };
}

describe("SendNotificationWithDedupUseCase — 중복 방지 알림 발송", () => {
  it("전략 없는 타입이면 락 없이 바로 발송한다", async () => {
    // Given
    const { useCase, sendNotification, dedupLock } = setup();

    // When
    await useCase.execute(nudgeData);

    // Then
    expect(dedupLock.acquiredKeys).toEqual([]);
    expect(sendNotification.sent).toEqual([nudgeData]);
  });

  it("락 경합(acquire=null) 시 null 반환하고 발송하지 않는다", async () => {
    // Given
    const { useCase, sendNotification, dedupLock } = setup();
    dedupLock.hold(FOLLOW_DEDUP_KEY);

    // When
    const result = await useCase.execute(followData);

    // Then
    expect(result).toBeNull();
    expect(sendNotification.sent).toEqual([]);
  });

  it("24시간 안에 같은 친구의 같은 알림이 있으면 skip(null)하고 락을 해제한다", async () => {
    // Given
    const recent = createInboxNotificationFixture({
      type: "FOLLOW_NEW",
      friendId: "friend-1",
      createdAt: NOTIFICATION_FIXTURE_NOW.subtract({ hours: 23 }),
    });
    const { useCase, sendNotification, dedupLock } = setup([recent]);

    // When
    const result = await useCase.execute(followData);

    // Then
    expect(result).toBeNull();
    expect(sendNotification.sent).toEqual([]);
    expect(dedupLock.releasedKeys).toEqual([FOLLOW_DEDUP_KEY]);
  });

  it("최근 중복이 없으면(24시간 지난 알림·다른 친구) 발송하고 락을 해제한다", async () => {
    // Given
    const stale = createInboxNotificationFixture({
      id: 1,
      type: "FOLLOW_NEW",
      friendId: "friend-1",
      createdAt: NOTIFICATION_FIXTURE_NOW.subtract({ hours: 25 }),
    });
    const otherFriend = createInboxNotificationFixture({
      id: 2,
      type: "FOLLOW_NEW",
      friendId: "friend-2",
      createdAt: NOTIFICATION_FIXTURE_NOW,
    });
    const { useCase, sendNotification, dedupLock } = setup([stale, otherFriend]);

    // When
    await useCase.execute(followData);

    // Then
    expect(sendNotification.sent).toEqual([followData]);
    expect(dedupLock.acquiredKeys).toEqual([FOLLOW_DEDUP_KEY]);
    expect(dedupLock.releasedKeys).toEqual([FOLLOW_DEDUP_KEY]);
  });
});
