import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import {
  type AfterCommitTask,
  type AfterCommitTaskRegistryPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { NotificationBuilder } from "#test/builders/index";
import { createNotificationCacheMock } from "#test/mocks/ports/notification-cache.mock";
import { createNotificationRepositoryMock } from "#test/mocks/ports/notification.mock";
import { createUnitOfWorkMock } from "#test/mocks/ports/unit-of-work.mock";

import { type NotificationCachePort } from "../../ports/delivery/notification-cache.port.js";
import type { CreateNotificationData } from "../../ports/delivery/notification-data.js";
import {
  DuplicateNotificationError,
  type NotificationRepositoryPort,
} from "../../ports/delivery/notification.repository.port.js";
import { type PushDispatchStagingRepositoryPort } from "../../ports/delivery/push-dispatch-staging.repository.port.js";
import { PushDeliveryAfterCommitPublisher } from "../../services/delivery/push-delivery-after-commit.publisher.js";
import { SendNotification } from "./send-notification.use-case.js";

const data: CreateNotificationData = {
  userId: "user-1",
  type: "FOLLOW_NEW",
  title: "새 친구 요청",
  body: "누군가 친구가 되고 싶어해요",
  friendId: "friend-1",
};

function createPushDispatchStagingMock(): PushDispatchStagingRepositoryPort {
  return {
    stage: vi.fn(),
    stageMany: vi.fn(),
  };
}

describe("SendNotification", () => {
  let useCase: SendNotification;
  let repository: Mocked<NotificationRepositoryPort>;
  let staging: Mocked<PushDispatchStagingRepositoryPort>;
  let cache: Mocked<NotificationCachePort>;
  let unitOfWork: Mocked<UnitOfWorkPort>;
  let afterCommitPublisher: Mocked<PushDeliveryAfterCommitPublisher>;
  let afterCommitTasks: AfterCommitTask[];

  beforeEach(async () => {
    NotificationBuilder.resetIdCounter();
    afterCommitTasks = [];
    const afterCommit: AfterCommitTaskRegistryPort = {
      register: vi.fn((task) => afterCommitTasks.push(task)),
    };

    const sendNotificationDependencies = mockDeep<
      ConstructorParameters<typeof SendNotification>[0]
    >({
      notificationRepository: createNotificationRepositoryMock(),
      pushDispatchStaging: createPushDispatchStagingMock(),
      cache: createNotificationCacheMock(),
      unitOfWork: createUnitOfWorkMock(),
      afterCommit: afterCommit,
    });
    const unit = new SendNotification(sendNotificationDependencies);
    useCase = unit;
    repository = sendNotificationDependencies.notificationRepository;
    staging = sendNotificationDependencies.pushDispatchStaging;
    cache = sendNotificationDependencies.cache;
    unitOfWork = sendNotificationDependencies.unitOfWork;
    afterCommitPublisher = sendNotificationDependencies.afterCommitPublisher;
    staging.stage.mockResolvedValue({ dispatchId: 41, notificationId: 1 });
    cache.invalidateUnreadCount.mockResolvedValue(undefined);
  });

  it("unique 제약 위반이면 null을 반환하고 dispatch와 부수효과를 준비하지 않는다", async () => {
    repository.createNotification.mockRejectedValue(new DuplicateNotificationError());

    const result = await useCase.execute(data);

    expect(result).toBeNull();
    expect(staging.stage).not.toHaveBeenCalled();
    expect(afterCommitPublisher.register).not.toHaveBeenCalled();
    expect(afterCommitTasks).toHaveLength(0);
  });

  it("unique 위반이 아닌 오류는 재전파하고 dispatch를 준비하지 않는다", async () => {
    repository.createNotification.mockRejectedValue(new Error("db down"));

    await expect(useCase.execute(data)).rejects.toThrow("db down");
    expect(staging.stage).not.toHaveBeenCalled();
    expect(afterCommitPublisher.register).not.toHaveBeenCalled();
  });

  it("알림과 SINGLE dispatch를 같은 UOW에서 준비하고 캐시는 커밋 후 무효화한다", async () => {
    const notification = NotificationBuilder.create(data.userId).withId(1).build();
    repository.createNotification.mockResolvedValue(notification);

    const result = await useCase.execute(data);

    expect(result).toBe(notification);
    expect(unitOfWork.run).toHaveBeenCalledTimes(1);
    expect(staging.stage).toHaveBeenCalledWith({
      notificationId: 1,
      userId: data.userId,
      purpose: "TRANSACTIONAL",
      campaignKey: undefined,
      variantId: undefined,
      deliveryMode: "SINGLE",
      force: false,
    });
    expect(afterCommitPublisher.register).toHaveBeenCalledWith([41]);
    expect(cache.invalidateUnreadCount).not.toHaveBeenCalled();
    expect(afterCommitTasks).toHaveLength(1);

    await Promise.all(afterCommitTasks.map((task) => task()));

    expect(cache.invalidateUnreadCount).toHaveBeenCalledWith(data.userId);
  });

  it("캐시 backend가 응답하지 않아도 after-commit task를 붙잡지 않는다", async () => {
    const notification = NotificationBuilder.create(data.userId).withId(1).build();
    repository.createNotification.mockResolvedValue(notification);
    cache.invalidateUnreadCount.mockReturnValue(new Promise(() => undefined));
    await useCase.execute(data);

    const cacheTask = afterCommitTasks[0];
    expect(cacheTask).toBeDefined();
    if (!cacheTask) throw new Error("Expected unread cache after-commit task");
    await expect(cacheTask()).resolves.toBeUndefined();
    expect(cache.invalidateUnreadCount).toHaveBeenCalledWith(data.userId);
  });
});
