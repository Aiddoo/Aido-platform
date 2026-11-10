import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { InMemoryNotificationRepository } from "#test/doubles/notification/in-memory-notification.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createInboxNotificationFixture } from "#test/fixtures/notification/notification.fixture";

import type { NotificationHistoryReader } from "../../../inbox/application/notification-history.reader.js";
import type { CreateNotificationData } from "../../../inbox/application/ports/notification-draft.port.js";
import type { FindAlreadyNotifiedUserIdsQuery } from "../../../inbox/application/ports/notification-history.reader.port.js";
import { DuplicateNotificationError } from "../../../inbox/application/ports/notification.repository.port.js";
import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../domain/transactional-notification-campaign.constants.js";
import type { UserNotificationSettingsPort } from "../ports/user-notification-settings.port.js";
import type { PersistedBatchNotificationResult } from "../read-models/push-delivery.read-model.js";
import type { FinalizeBatchNotificationUseCase } from "./finalize-batch-notification.use-case.js";
import type { PersistBatchNotificationUseCase } from "./persist-batch-notification.use-case.js";
import { SendFriendCompletionNotificationsUseCase } from "./send-friend-completion-notifications.use-case.js";

// 서울 2026-11-10 09:00
const NOW = Temporal.Instant.from("2026-11-10T00:00:00Z");
const SEOUL_NOTIFICATION_DATE = new Date("2026-11-10T00:00:00.000Z");

const input = {
  friendId: "friend-1",
  friendName: "민재",
  notifyUserIds: ["user-1", "user-2"],
  timezone: "Asia/Seoul",
};

class RecordingHistoryReader implements Pick<
  NotificationHistoryReader,
  "findAlreadyNotifiedUserIds"
> {
  readonly #events: string[];
  readonly #history: InMemoryNotificationRepository;

  constructor(events: string[], history: InMemoryNotificationRepository) {
    this.#events = events;
    this.#history = history;
  }

  async findAlreadyNotifiedUserIds(query: FindAlreadyNotifiedUserIdsQuery): Promise<Set<string>> {
    this.#events.push("dedup-read");
    return this.#history.findAlreadyNotifiedUserIds(query);
  }
}

class RecordingPreferenceReader implements Pick<
  UserNotificationSettingsPort,
  "getPreferenceRecordsByUserIds"
> {
  readonly #events: string[];

  constructor(events: string[]) {
    this.#events = events;
  }

  async getPreferenceRecordsByUserIds(): Promise<never[]> {
    this.#events.push("preference-read");
    return [];
  }
}

class RecordingUnitOfWork implements Pick<UnitOfWorkPort, "run"> {
  readonly #events: string[];
  failWith: Error | null = null;

  constructor(events: string[]) {
    this.#events = events;
  }

  async run<T>(work: () => Promise<T>): Promise<T> {
    this.#events.push("uow-start");
    if (this.failWith != null) {
      throw this.failWith;
    }
    const result = await work();
    this.#events.push("uow-end");
    return result;
  }
}

class RecordingPersistBatch implements Pick<PersistBatchNotificationUseCase, "execute"> {
  readonly #events: string[];
  readonly persisted: CreateNotificationData[][] = [];

  constructor(events: string[]) {
    this.#events = events;
  }

  async execute(dataList: CreateNotificationData[]): Promise<PersistedBatchNotificationResult> {
    this.#events.push("persist");
    this.persisted.push(dataList);
    return { count: dataList.length, sourceData: dataList };
  }
}

class RecordingFinalizeBatch implements Pick<FinalizeBatchNotificationUseCase, "execute"> {
  readonly #events: string[];

  constructor(events: string[]) {
    this.#events = events;
  }

  async execute(input: PersistedBatchNotificationResult): Promise<{ count: number }> {
    this.#events.push("finalize-post-commit");
    return { count: input.count };
  }
}

function setup(history: InMemoryNotificationRepository = new InMemoryNotificationRepository()) {
  const events: string[] = [];
  const unitOfWork = new RecordingUnitOfWork(events);
  const persistBatch = new RecordingPersistBatch(events);
  const useCase = new SendFriendCompletionNotificationsUseCase({
    notificationHistoryReader: new RecordingHistoryReader(events, history),
    persistBatch,
    finalizeBatch: new RecordingFinalizeBatch(events),
    unitOfWork,
    userNotificationSettings: new RecordingPreferenceReader(events),
    clock: new FixedClock(NOW),
    logger: new SilentLogger(),
  });
  return { useCase, events, unitOfWork, persistBatch };
}

describe("SendFriendCompletionNotificationsUseCase — 친구 완료 알림", () => {
  it("UoW 전에 외부 정보를 조회하고 영속화 후에만 후속 작업을 실행한다", async () => {
    // Given
    const { useCase, events, persistBatch } = setup();

    // When
    await useCase.execute(input);

    // Then
    expect(events).toEqual([
      "dedup-read",
      "preference-read",
      "uow-start",
      "persist",
      "uow-end",
      "finalize-post-commit",
    ]);
    expect(persistBatch.persisted).toEqual([
      [
        expect.objectContaining({
          userId: "user-1",
          type: "FRIEND_COMPLETED",
          friendId: "friend-1",
          notificationDate: SEOUL_NOTIFICATION_DATE,
          campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.FRIEND_COMPLETED,
        }),
        expect.objectContaining({
          userId: "user-2",
          type: "FRIEND_COMPLETED",
          friendId: "friend-1",
          notificationDate: SEOUL_NOTIFICATION_DATE,
        }),
      ],
    ]);
  });

  it("오늘(수신자 시간대) 같은 친구 완료 알림을 이미 받은 사용자는 빼고 보낸다", async () => {
    // Given
    const history = new InMemoryNotificationRepository([
      createInboxNotificationFixture({
        userId: "user-1",
        type: "FRIEND_COMPLETED",
        friendId: "friend-1",
        notificationDate: Temporal.PlainDate.from("2026-11-10"),
      }),
    ]);
    const { useCase, persistBatch } = setup(history);

    // When
    await useCase.execute(input);

    // Then
    expect(persistBatch.persisted.map((batch) => batch.map((data) => data.userId))).toEqual([
      ["user-2"],
    ]);
  });

  it("이미 알림을 받은 사용자를 제외하고 대상이 없으면 발송을 건너뛴다", async () => {
    // Given
    const history = new InMemoryNotificationRepository(
      ["user-1", "user-2"].map((userId, index) =>
        createInboxNotificationFixture({
          id: index + 1,
          userId,
          type: "FRIEND_COMPLETED",
          friendId: "friend-1",
          notificationDate: Temporal.PlainDate.from("2026-11-10"),
        }),
      ),
    );
    const { useCase, events } = setup(history);

    // When
    await useCase.execute(input);

    // Then
    expect(events).toEqual(["dedup-read"]);
  });

  it("영속화 중 중복 오류가 나면 다른 실행의 성공으로 처리한다", async () => {
    // Given
    const { useCase, events, unitOfWork } = setup();
    unitOfWork.failWith = new DuplicateNotificationError();

    // When
    const result = useCase.execute(input);

    // Then
    await expect(result).resolves.toBeUndefined();
    expect(events).not.toContain("finalize-post-commit");
  });
});
