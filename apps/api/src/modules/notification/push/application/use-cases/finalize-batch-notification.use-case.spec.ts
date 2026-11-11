import { PassThroughNotificationCache } from "#test/doubles/notification/pass-through-notification-cache";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createNotificationDraftFixture } from "#test/fixtures/notification/notification.fixture";

import { NotificationDeliveryLogEvent } from "../notification-delivery.log-events.js";
import type {
  NotificationDedupPort,
  NotificationDedupRecord,
} from "../ports/notification-dedup.port.js";
import { FinalizeBatchNotificationUseCase } from "./finalize-batch-notification.use-case.js";

class RecordingNotificationDedup implements Pick<NotificationDedupPort, "recordNotifiedUsers"> {
  readonly records: NotificationDedupRecord[] = [];
  failure: Error | null = null;

  async recordNotifiedUsers(records: NotificationDedupRecord[]): Promise<void> {
    if (this.failure != null) {
      throw this.failure;
    }
    this.records.push(...records);
  }
}

function createFinalizeUseCase() {
  const cache = new PassThroughNotificationCache();
  const notificationDedup = new RecordingNotificationDedup();
  const logger = new SilentLogger();
  const useCase = new FinalizeBatchNotificationUseCase({ cache, notificationDedup, logger });
  return { cache, notificationDedup, logger, useCase };
}

describe("FinalizeBatchNotificationUseCase — 배치 알림 커밋 뒤 정리", () => {
  it("수신자마다 미읽음 캐시를 한 번 비우고 날짜가 있는 알림만 dedup에 기록한다", async () => {
    // Given
    const { cache, notificationDedup, useCase } = createFinalizeUseCase();
    const notificationDate = Temporal.PlainDate.from("2026-03-09");
    const sourceData = [
      createNotificationDraftFixture({ userId: "u1", type: "FRIEND_COMPLETED", notificationDate }),
      createNotificationDraftFixture({ userId: "u2", type: "FRIEND_COMPLETED", notificationDate }),
      createNotificationDraftFixture({ userId: "u2", type: "FOLLOW_NEW" }),
    ];

    // When
    const result = await useCase.execute({ count: 3, sourceData });

    // Then
    expect(result).toEqual({ count: 3 });
    expect(cache.invalidatedUnreadCountUserIds).toEqual(["u1", "u2"]);
    expect(notificationDedup.records).toEqual([
      { userId: "u1", type: "FRIEND_COMPLETED", notificationDate },
      { userId: "u2", type: "FRIEND_COMPLETED", notificationDate },
    ]);
  });

  it("커밋 후 캐시·dedup 실패를 흡수하여 저장된 알림을 재시도하지 않는다", async () => {
    // Given
    const { cache, notificationDedup, logger, useCase } = createFinalizeUseCase();
    cache.failUnreadCountInvalidationFor.add("u1");
    notificationDedup.failure = new Error("dedup unavailable");

    // When
    const result = useCase.execute({
      count: 1,
      sourceData: [createNotificationDraftFixture({ userId: "u1" })],
    });

    // Then
    await expect(result).resolves.toEqual({ count: 1 });
    expect(logger.messages).toEqual([
      expect.objectContaining({
        event: NotificationDeliveryLogEvent.FINALIZE_BATCH_NOTIFICATION_UNREAD_CACHE_FAILED,
      }),
      expect.objectContaining({
        event: NotificationDeliveryLogEvent.FINALIZE_BATCH_NOTIFICATION_DEDUP_RECORD_FAILED,
      }),
    ]);
  });
});
