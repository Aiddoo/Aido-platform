import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { InMemoryNotificationRepository } from "#test/doubles/notification/in-memory-notification.repository";
import { PassThroughNotificationCache } from "#test/doubles/notification/pass-through-notification-cache";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingAfterCommitRegistry } from "#test/doubles/platform/recording-after-commit-registry";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  createNotificationDraftFixture,
  NOTIFICATION_FIXTURE_USER_ID,
} from "#test/fixtures/notification/notification.fixture";

import type { CreateNotificationData } from "../../../inbox/application/ports/notification-draft.port.js";
import { DuplicateNotificationError } from "../../../inbox/application/ports/notification.repository.port.js";
import {
  PushDispatchStagingRepositoryPort,
  type StagedPushDispatch,
  type StagePushDispatchInput,
} from "../ports/push-dispatch-staging.repository.port.js";
import type { PublishPushDeliveryAfterCommitUseCase } from "./publish-push-delivery-after-commit.use-case.js";
import { SendNotificationUseCase } from "./send-notification.use-case.js";

const DISPATCH_ID = 41;

const data = createNotificationDraftFixture({
  type: "FOLLOW_NEW",
  title: "새 친구 요청",
  body: "누군가 친구가 되고 싶어해요",
  friendId: "friend-1",
});

class RecordingPushDispatchStaging extends PushDispatchStagingRepositoryPort {
  readonly staged: StagePushDispatchInput[] = [];

  async stage(input: StagePushDispatchInput): Promise<StagedPushDispatch> {
    this.staged.push(input);
    return { dispatchId: DISPATCH_ID, notificationId: input.notificationId };
  }

  async stageMany(inputs: readonly StagePushDispatchInput[]): Promise<StagedPushDispatch[]> {
    return Promise.all(inputs.map((input) => this.stage(input)));
  }
}

class RecordingAfterCommitPublisher implements Pick<
  PublishPushDeliveryAfterCommitUseCase,
  "register"
> {
  readonly registeredDispatchIds: number[][] = [];

  register(dispatchIds: readonly number[]): void {
    this.registeredDispatchIds.push([...dispatchIds]);
  }
}

class FailingNotificationRepository extends InMemoryNotificationRepository {
  readonly #error: Error;

  constructor(error: Error) {
    super();
    this.#error = error;
  }

  override async createNotification(_data: CreateNotificationData): Promise<never> {
    throw this.#error;
  }
}

class HangingNotificationCache extends PassThroughNotificationCache {
  override invalidateUnreadCount(user: UserId): Promise<void> {
    const userId = user.value;
    this.invalidatedUnreadCountUserIds.push(userId);
    return new Promise(() => undefined);
  }
}

function setup(
  overrides: {
    notificationRepository?: InMemoryNotificationRepository;
    cache?: PassThroughNotificationCache;
  } = {},
) {
  const notificationRepository =
    overrides.notificationRepository ?? new InMemoryNotificationRepository();
  const pushDispatchStaging = new RecordingPushDispatchStaging();
  const cache = overrides.cache ?? new PassThroughNotificationCache();
  const unitOfWork = new ImmediateUnitOfWork();
  const afterCommit = new RecordingAfterCommitRegistry();
  const afterCommitPublisher = new RecordingAfterCommitPublisher();
  const useCase = new SendNotificationUseCase({
    notificationRepository,
    pushDispatchStaging,
    cache,
    unitOfWork,
    afterCommit,
    afterCommitPublisher,
    logger: new SilentLogger(),
  });
  return {
    useCase,
    notificationRepository,
    pushDispatchStaging,
    cache,
    unitOfWork,
    afterCommit,
    afterCommitPublisher,
  };
}

describe("SendNotificationUseCase — 단건 알림 생성과 발송 준비", () => {
  it("unique 제약 위반이면 null을 반환하고 dispatch와 부수효과를 준비하지 않는다", async () => {
    // Given
    const { useCase, pushDispatchStaging, afterCommit, afterCommitPublisher } = setup({
      notificationRepository: new FailingNotificationRepository(new DuplicateNotificationError()),
    });

    // When
    const result = await useCase.execute(data);

    // Then
    expect(result).toBeNull();
    expect(pushDispatchStaging.staged).toEqual([]);
    expect(afterCommitPublisher.registeredDispatchIds).toEqual([]);
    expect(afterCommit.tasks).toHaveLength(0);
  });

  it("unique 위반이 아닌 오류는 재전파하고 dispatch를 준비하지 않는다", async () => {
    // Given
    const { useCase, pushDispatchStaging, afterCommitPublisher } = setup({
      notificationRepository: new FailingNotificationRepository(new Error("db down")),
    });

    // When
    const result = useCase.execute(data);

    // Then
    await expect(result).rejects.toThrow("db down");
    expect(pushDispatchStaging.staged).toEqual([]);
    expect(afterCommitPublisher.registeredDispatchIds).toEqual([]);
  });

  it("알림과 SINGLE dispatch를 같은 UOW에서 준비하고 캐시는 커밋 후 무효화한다", async () => {
    // Given
    const {
      useCase,
      notificationRepository,
      pushDispatchStaging,
      cache,
      unitOfWork,
      afterCommit,
      afterCommitPublisher,
    } = setup();

    // When
    const result = await useCase.execute(data);

    // Then
    expect(result).toMatchObject({
      id: 1,
      userId: NOTIFICATION_FIXTURE_USER_ID,
      type: "FOLLOW_NEW",
    });
    expect(notificationRepository.rowOf(1)).toEqual(result);
    expect(unitOfWork.runCount).toBe(1);
    expect(pushDispatchStaging.staged).toEqual([
      {
        notificationId: 1,
        userId: NOTIFICATION_FIXTURE_USER_ID,
        purpose: "TRANSACTIONAL",
        campaignKey: undefined,
        variantId: undefined,
        deliveryMode: "SINGLE",
        force: false,
      },
    ]);
    expect(afterCommitPublisher.registeredDispatchIds).toEqual([[DISPATCH_ID]]);
    expect(cache.invalidatedUnreadCountUserIds).toEqual([]);
    expect(afterCommit.tasks).toHaveLength(1);

    // When
    await afterCommit.runAll();

    // Then
    expect(cache.invalidatedUnreadCountUserIds).toEqual([NOTIFICATION_FIXTURE_USER_ID]);
  });

  it("캐시 backend가 응답하지 않아도 after-commit task를 붙잡지 않는다", async () => {
    // Given
    const cache = new HangingNotificationCache();
    const { useCase, afterCommit } = setup({ cache });
    await useCase.execute(data);

    // When
    const result = afterCommit.runAll();

    // Then
    await expect(result).resolves.toBeUndefined();
    expect(cache.invalidatedUnreadCountUserIds).toEqual([NOTIFICATION_FIXTURE_USER_ID]);
  });
});
