import { AsyncLocalStorage } from "node:async_hooks";

import { Test, type TestingModule } from "@nestjs/testing";
import { vi, type Mocked, type MockedFunction } from "vitest";

import { NotificationHistoryReader } from "#api/modules/notification/notifications/application/notification-history.reader";
import { NotificationCachePort } from "#api/modules/notification/notifications/application/ports/notification-cache.port";
import { NotificationDeduplicationPort } from "#api/modules/notification/notifications/application/ports/notification-deduplication.port";
import { NotificationRepositoryPort } from "#api/modules/notification/notifications/application/ports/notification.repository.port";
import type { InboxNotificationReadModel } from "#api/modules/notification/notifications/application/read-models/inbox-notification.read-model";
import { FinalizeBatchNotificationUseCase } from "#api/modules/notification/notifications/application/use-cases/finalize-batch-notification.use-case";
import { PersistBatchNotificationUseCase } from "#api/modules/notification/notifications/application/use-cases/persist-batch-notification.use-case";
import { SendFriendCompletionNotificationsUseCase } from "#api/modules/notification/notifications/application/use-cases/send-friend-completion-notifications.use-case";
import { NOTIFICATION_NOTIFICATIONS_USE_CASE_PROVIDERS } from "#api/modules/notification/notifications/notification-notifications.providers";
import { PushDispatchRepositoryPort } from "#api/modules/notification/push-dispatches/application/ports/push-dispatch.repository.port";
import { PublishPushDeliveryAfterCommitUseCase } from "#api/modules/notification/push-dispatches/application/use-cases/publish-push-delivery-after-commit.use-case";
import {
  PublishPushDeliveryOutboxUseCase,
  type PublishPushDeliveryOutboxInput,
} from "#api/modules/notification/push-dispatches/application/use-cases/publish-push-delivery-outbox.use-case";
import { PushDispatchId } from "#api/modules/notification/push-dispatches/domain/push-dispatch-id.vo";
import type { PushDispatch } from "#api/modules/notification/push-dispatches/domain/push-dispatch.aggregate";
import { NOTIFICATION_PUSH_DISPATCHES_USE_CASE_PROVIDERS } from "#api/modules/notification/push-dispatches/notification-push-dispatches.providers";
import { UserNotificationSettingsPort } from "#api/modules/notification/shared/application/ports/user-notification-settings.port";
import type { CreateNotificationData } from "#api/modules/notification/shared/domain/notification-draft.constants";
import { SystemClock } from "#api/platform/time/system-clock";
import {
  type AfterCommitTask,
  AfterCommitTaskRegistryPort,
} from "#api/shared/application/ports/after-commit-task.registry.port";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { InMemoryNotificationRepository } from "#test/doubles/notification/in-memory-notification.repository";
import { PassThroughNotificationCache } from "#test/doubles/notification/pass-through-notification-cache";
import { pickProviders } from "#test/integration/helpers/pick-providers";

interface TransactionContext {
  closed: boolean;
  afterCommitTasks: AfterCommitTask[];
}

/** Required 전파와 after-commit 실행 시점을 함께 관찰하는 component-test UOW. */
class AfterCommitAwareUnitOfWork implements UnitOfWorkPort, AfterCommitTaskRegistryPort {
  readonly storage = new AsyncLocalStorage<TransactionContext>();
  rootTransactionCount = 0;

  async run<T>(work: () => Promise<T>): Promise<T> {
    const active = this.storage.getStore();
    if (active && !active.closed) {
      return work();
    }

    this.rootTransactionCount += 1;
    const context: TransactionContext = { closed: false, afterCommitTasks: [] };
    return this.storage.run(context, async () => {
      let result: T;
      try {
        result = await work();
      } catch (error) {
        context.closed = true;
        throw error;
      }

      context.closed = true;
      for (const task of context.afterCommitTasks) {
        await task();
      }
      return result;
    });
  }

  register(task: AfterCommitTask): void {
    const active = this.storage.getStore();
    if (!active || active.closed) {
      throw new Error("After-commit task must be registered in an active test UOW");
    }
    active.afterCommitTasks.push(task);
  }
}

// 알림 저장이 열린 UoW 안에서 일어났는지와 순서를 남긴다
class EventRecordingNotificationRepository extends InMemoryNotificationRepository {
  readonly #onCreateMany: () => void;

  constructor(onCreateMany: () => void) {
    super([], () => new Date("2026-07-26T00:00:00.000Z"));
    this.#onCreateMany = onCreateMany;
  }

  override async createManyNotificationsAndReturn(
    dataList: CreateNotificationData[],
  ): Promise<InboxNotificationReadModel[]> {
    this.#onCreateMany();
    return super.createManyNotificationsAndReturn(dataList);
  }
}

class EventRecordingNotificationCache extends PassThroughNotificationCache {
  readonly #events: string[];

  constructor(events: string[]) {
    super();
    this.#events = events;
  }

  override async invalidateUnreadCount(user: UserId): Promise<void> {
    const userId = user.value;
    this.#events.push(`invalidate-cache:${userId}`);
    await super.invalidateUnreadCount(user);
  }
}

const friendCompletionInput = {
  friendId: "friend-1",
  friendName: "완료 친구",
  notifyUserIds: ["user-1", "user-2"],
  timezone: "Asia/Seoul",
};

describe("친구 완료 알림의 commit 후 영속 발행 (컴포넌트)", () => {
  let module: TestingModule;
  let useCase: SendFriendCompletionNotificationsUseCase;
  let persistBatch: PersistBatchNotificationUseCase;
  let unitOfWork: AfterCommitAwareUnitOfWork;
  let repository: EventRecordingNotificationRepository;
  let staging: Mocked<PushDispatchRepositoryPort>;
  let executePublish: MockedFunction<(input: PublishPushDeliveryOutboxInput) => Promise<number>>;
  let events: string[];

  beforeEach(async () => {
    events = [];
    unitOfWork = new AfterCommitAwareUnitOfWork();
    repository = new EventRecordingNotificationRepository(() => {
      expect(unitOfWork.storage.getStore()?.closed).toBe(false);
      events.push("persist-notifications");
    });
    staging = vi.mocked({
      nextIds: vi.fn(async (count: number) =>
        Array.from({ length: count }, (_, index) => PushDispatchId.reconstitute(201 + index)),
      ),
      saveAll: vi.fn(async (_dispatches: readonly PushDispatch[]) => {
        expect(unitOfWork.storage.getStore()?.closed).toBe(false);
        events.push("stage-dispatch-outbox");
      }),
    } satisfies PushDispatchRepositoryPort);
    const cache = new EventRecordingNotificationCache(events);
    const notificationDeduplication: NotificationDeduplicationPort = {
      recordNotifiedUsers: vi.fn(async () => {
        events.push("record-dedup");
      }),
      readKnownRecipients: vi.fn(),
      warmRecipients: vi.fn(),
    };
    const userSettings: UserNotificationSettingsPort = {
      upsertPushTimezone: vi.fn(),
      upsertPushLocale: vi.fn(),
      getPreferenceRecord: vi.fn(),
      getPreferenceRecordsByUserIds: vi.fn().mockResolvedValue([]),
      getConsentRecord: vi.fn(),
      getConsentRecordsByUserIds: vi.fn(),
      updateMarketingPushConsent: vi.fn(),
    };
    const notificationHistoryReader = {
      findAlreadyNotifiedUserIds: vi.fn().mockResolvedValue(new Set<string>()),
    };
    executePublish = vi.fn(async (input) => {
      expect(unitOfWork.storage.getStore()?.closed).toBe(true);
      events.push("publish-delivery-job");
      return input.kind === "dispatches" ? input.dispatchIds.length : 0;
    });

    module = await Test.createTestingModule({
      providers: [
        ...pickProviders(NOTIFICATION_NOTIFICATIONS_USE_CASE_PROVIDERS, [
          SendFriendCompletionNotificationsUseCase,
          PersistBatchNotificationUseCase,
          FinalizeBatchNotificationUseCase,
        ]),
        ...pickProviders(NOTIFICATION_PUSH_DISPATCHES_USE_CASE_PROVIDERS, [
          PublishPushDeliveryAfterCommitUseCase,
        ]),
        { provide: NotificationHistoryReader, useValue: notificationHistoryReader },
        { provide: NotificationRepositoryPort, useValue: repository },
        { provide: PushDispatchRepositoryPort, useValue: staging },
        { provide: NotificationCachePort, useValue: cache },
        { provide: NotificationDeduplicationPort, useValue: notificationDeduplication },
        { provide: UserNotificationSettingsPort, useValue: userSettings },
        { provide: UnitOfWorkPort, useValue: unitOfWork },
        { provide: AfterCommitTaskRegistryPort, useValue: unitOfWork },
        { provide: ClockPort, useClass: SystemClock },
        { provide: PublishPushDeliveryOutboxUseCase, useValue: { execute: executePublish } },
      ],
    }).compile();

    useCase = module.get(SendFriendCompletionNotificationsUseCase);
    persistBatch = module.get(PersistBatchNotificationUseCase);
  });

  afterEach(async () => {
    await module?.close();
  });

  it("알림과 BATCH outbox를 원자적으로 저장하고 root commit 후에만 발행한다", async () => {
    // When
    await useCase.execute(friendCompletionInput);

    // Then
    expect(unitOfWork.rootTransactionCount).toBe(1);
    expect(
      staging.saveAll.mock.calls.flatMap(([dispatches]) =>
        dispatches.map((dispatch) => dispatch.toPrimitives()),
      ),
    ).toEqual([
      expect.objectContaining({
        notificationId: 1,
        recipientId: "user-1",
        deliveryMode: "BATCH",
        force: false,
      }),
      expect.objectContaining({
        notificationId: 2,
        recipientId: "user-2",
        deliveryMode: "BATCH",
        force: false,
      }),
    ]);
    expect(executePublish).toHaveBeenCalledWith({
      kind: "dispatches",
      dispatchIds: [201, 202],
    });
    expect(events).toEqual([
      "persist-notifications",
      "stage-dispatch-outbox",
      "publish-delivery-job",
      "invalidate-cache:user-1",
      "invalidate-cache:user-2",
      "record-dedup",
    ]);
  });

  it("외부 UoW가 rollback되면 등록된 발송 작업을 발행하지 않는다", async () => {
    // Given
    const data: CreateNotificationData[] = [
      {
        userId: "user-1",
        type: "FRIEND_COMPLETED",
        title: "친구 완료",
        body: "친구가 오늘 할 일을 마쳤어요",
        friendId: "friend-1",
      },
    ];

    // When
    const result = unitOfWork.run(async () => {
      await persistBatch.execute(data);
      throw new Error("rollback persistence transaction");
    });

    // Then
    await expect(result).rejects.toThrow("rollback persistence transaction");
    expect(unitOfWork.rootTransactionCount).toBe(1);
    expect(
      repository.rows().map(({ userId, type, friendId }) => ({ userId, type, friendId })),
    ).toEqual([{ userId: "user-1", type: "FRIEND_COMPLETED", friendId: "friend-1" }]);
    expect(staging.saveAll).toHaveBeenCalledTimes(1);
    expect(executePublish).not.toHaveBeenCalled();
  });
});
