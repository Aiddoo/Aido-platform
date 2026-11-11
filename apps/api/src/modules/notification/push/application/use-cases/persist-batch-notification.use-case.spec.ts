import { InMemoryNotificationRepository } from "#test/doubles/notification/in-memory-notification.repository";
import { InMemoryPushDispatchStagingRepository } from "#test/doubles/notification/in-memory-push-dispatch-staging.repository";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { createNotificationDraftFixture } from "#test/fixtures/notification/notification.fixture";

import type { CreateNotificationData } from "../../../inbox/application/ports/notification-draft.port.js";
import { PersistBatchNotificationUseCase } from "./persist-batch-notification.use-case.js";
import type { PublishPushDeliveryAfterCommitUseCase } from "./publish-push-delivery-after-commit.use-case.js";

class RecordingAfterCommitPublisher implements Pick<
  PublishPushDeliveryAfterCommitUseCase,
  "register"
> {
  readonly registered: number[][] = [];

  register(dispatchIds: readonly number[]): void {
    this.registered.push([...dispatchIds]);
  }
}

function createPersistUseCase() {
  const notificationRepository = new InMemoryNotificationRepository();
  const pushDispatchStaging = new InMemoryPushDispatchStagingRepository(101);
  const unitOfWork = new ImmediateUnitOfWork();
  const afterCommitPublisher = new RecordingAfterCommitPublisher();
  const useCase = new PersistBatchNotificationUseCase({
    notificationRepository,
    pushDispatchStaging,
    unitOfWork,
    afterCommitPublisher,
  });
  return { notificationRepository, pushDispatchStaging, unitOfWork, afterCommitPublisher, useCase };
}

describe("PersistBatchNotificationUseCase — 배치 알림과 dispatch 원자 저장", () => {
  it("알림과 BATCH dispatch를 같은 UOW에 저장하고 커밋 후 발행 ID를 등록한다", async () => {
    // Given
    const {
      notificationRepository,
      pushDispatchStaging,
      unitOfWork,
      afterCommitPublisher,
      useCase,
    } = createPersistUseCase();
    const dataList: CreateNotificationData[] = [
      createNotificationDraftFixture({
        userId: "u1",
        type: "SYSTEM_NOTICE",
        title: "공지",
        body: "본문",
        force: true,
      }),
      createNotificationDraftFixture({ userId: "u2", type: "FOLLOW_NEW", title: "t", body: "b" }),
    ];

    // When
    const result = await useCase.execute(dataList);

    // Then
    expect(result).toEqual({ count: 2, sourceData: dataList });
    expect(unitOfWork.runCount).toBe(1);
    expect(notificationRepository.rows()).toEqual([
      expect.objectContaining({ id: 1, userId: "u1", type: "SYSTEM_NOTICE", title: "공지" }),
      expect.objectContaining({ id: 2, userId: "u2", type: "FOLLOW_NEW", title: "t" }),
    ]);
    expect(pushDispatchStaging.dispatches).toEqual([
      expect.objectContaining({
        dispatchId: 101,
        notificationId: 1,
        userId: "u1",
        deliveryMode: "BATCH",
        force: true,
      }),
      expect.objectContaining({
        dispatchId: 102,
        notificationId: 2,
        userId: "u2",
        deliveryMode: "BATCH",
        force: false,
      }),
    ]);
    expect(afterCommitPublisher.registered).toEqual([[101, 102]]);
  });

  it("빈 입력은 UOW, DB, staging, 발행 등록을 모두 건너뛴다", async () => {
    // Given
    const {
      notificationRepository,
      pushDispatchStaging,
      unitOfWork,
      afterCommitPublisher,
      useCase,
    } = createPersistUseCase();

    // When
    const result = await useCase.execute([]);

    // Then
    expect(result).toEqual({ count: 0, sourceData: [] });
    expect(unitOfWork.runCount).toBe(0);
    expect(notificationRepository.size).toBe(0);
    expect(pushDispatchStaging.dispatches).toEqual([]);
    expect(afterCommitPublisher.registered).toEqual([]);
  });
});
