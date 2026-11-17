import { DAY_MS, MINUTE_MS } from "#api/shared/domain/time/time-units";
import { InMemoryNotificationRepository } from "#test/doubles/notification/in-memory-notification.repository";
import { PassThroughNotificationCache } from "#test/doubles/notification/pass-through-notification-cache";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  createInboxNotificationFixture,
  NOTIFICATION_FIXTURE_OTHER_USER_ID,
  NOTIFICATION_FIXTURE_USER_ID,
} from "#test/fixtures/notification/notification.fixture";

import type {
  DeletedNotificationHistory,
  NotificationRepositoryPort,
} from "../ports/notification.repository.port.js";
import { PurgeNotificationHistoryUseCase } from "./purge-notification-history.use-case.js";

const NOW = Temporal.Instant.from("2026-11-18T18:50:00Z");
const EXPIRED_AT = NOW.subtract({ milliseconds: 181 * DAY_MS });
const BATCH_SIZE = 500;

type DeleteQuery = Parameters<NotificationRepositoryPort["deleteCreatedBefore"]>[0];

// 받은 조건을 남기고 저장소에 넘긴다
class RecordingNotificationRepository extends InMemoryNotificationRepository {
  readonly queries: DeleteQuery[] = [];

  override async deleteCreatedBefore(query: DeleteQuery): Promise<DeletedNotificationHistory> {
    this.queries.push(query);
    return super.deleteCreatedBefore(query);
  }
}

function oldNotifications(count: number) {
  return Array.from({ length: count }, (_, index) =>
    createInboxNotificationFixture({
      id: index + 1,
      createdAt: EXPIRED_AT.add({ seconds: index }),
    }),
  );
}

function setUp(options: {
  readonly repository: Pick<NotificationRepositoryPort, "deleteCreatedBefore">;
  readonly pushCompleted?: boolean;
  readonly clock?: FixedClock;
}) {
  const cache = new PassThroughNotificationCache();
  const clock = options.clock ?? new FixedClock(NOW);
  const useCase = new PurgeNotificationHistoryUseCase({
    notificationRepository: options.repository,
    purgePushDeliveryHistory: {
      execute: async () => ({
        deletedReservations: 0,
        deletedDispatches: 0,
        completed: options.pushCompleted ?? true,
      }),
    },
    notificationCache: cache,
    clock,
    logger: new SilentLogger(),
  });
  return { useCase, cache };
}

describe("PurgeNotificationHistoryUseCase — 알림 보관 기간 정리", () => {
  it("발송 기록 정리가 끝나지 않으면 알림은 지우지 않고 다음 실행에 맡긴다", async () => {
    // Given
    const repository = new RecordingNotificationRepository(oldNotifications(3));
    const { useCase } = setUp({ repository, pushCompleted: false });

    // When
    const result = await useCase.execute();

    // Then
    expect(result).toEqual({ deletedNotifications: 0, completed: false });
    expect(repository.size).toBe(3);
  });

  it("묶음이 가득 차면 마지막으로 지운 생성 시각부터 이어 지운다", async () => {
    // Given
    const repository = new RecordingNotificationRepository(oldNotifications(BATCH_SIZE + 1));
    const { useCase } = setUp({ repository });

    // When
    const result = await useCase.execute();

    // Then
    expect(result).toEqual({ deletedNotifications: BATCH_SIZE + 1, completed: true });
    expect(repository.queries.map(({ createdFrom }) => createdFrom)).toEqual([
      null,
      EXPIRED_AT.add({ seconds: BATCH_SIZE - 1 }),
    ]);
  });

  it("2분 예산이 끝나면 남은 알림을 두고 completed false를 돌려준다", async () => {
    // Given
    const clock = new FixedClock(NOW);
    const fullBatches: Pick<NotificationRepositoryPort, "deleteCreatedBefore"> = {
      deleteCreatedBefore: async () => {
        clock.advanceBy({ milliseconds: MINUTE_MS });
        return { deletedCount: BATCH_SIZE, lastCreatedAt: EXPIRED_AT, unreadOwnerIds: [] };
      },
    };
    const { useCase } = setUp({ repository: fullBatches, clock });

    // When
    const result = await useCase.execute();

    // Then
    expect(result).toEqual({ deletedNotifications: 2 * BATCH_SIZE, completed: false });
  });

  it("안 읽은 알림이 지워진 사람의 미읽음 수 캐시만 비운다", async () => {
    // Given
    const repository = new RecordingNotificationRepository([
      ...oldNotifications(2),
      createInboxNotificationFixture({
        id: 3,
        userId: NOTIFICATION_FIXTURE_OTHER_USER_ID,
        isRead: true,
        createdAt: EXPIRED_AT,
      }),
    ]);
    const { useCase, cache } = setUp({ repository });

    // When
    await useCase.execute();

    // Then
    expect(cache.invalidatedUnreadCountUserIds).toEqual([NOTIFICATION_FIXTURE_USER_ID]);
  });

  it("미읽음 수 캐시를 비우지 못해도 정리를 이어 간다", async () => {
    // Given
    const repository = new RecordingNotificationRepository(oldNotifications(1));
    const { useCase, cache } = setUp({ repository });
    cache.failUnreadCountInvalidationFor.add(NOTIFICATION_FIXTURE_USER_ID);

    // When
    const result = await useCase.execute();

    // Then
    expect(result).toEqual({ deletedNotifications: 1, completed: true });
  });
});
