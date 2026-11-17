import { InMemoryNotificationRepository } from "#test/doubles/notification/in-memory-notification.repository";
import { InMemoryPushDispatchRepository } from "#test/doubles/notification/in-memory-push-dispatch.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { createNotificationDraftFixture } from "#test/fixtures/notification/notification.fixture";

import type { PublishPushDeliveryAfterCommitUseCase } from "../../../push-dispatches/application/use-cases/publish-push-delivery-after-commit.use-case.js";
import type { CreateNotificationData } from "../../../shared/domain/notification-draft.constants.js";
import { PersistBatchNotificationUseCase } from "./persist-batch-notification.use-case.js";

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
  const pushDispatchRepository = new InMemoryPushDispatchRepository(101);
  const unitOfWork = new ImmediateUnitOfWork();
  const afterCommitPublisher = new RecordingAfterCommitPublisher();
  const useCase = new PersistBatchNotificationUseCase({
    notificationRepository,
    pushDispatchRepository,
    clock: new FixedClock(Temporal.Instant.from("2026-11-18T00:00:00Z")),
    unitOfWork,
    afterCommitPublisher,
  });
  return {
    notificationRepository,
    pushDispatchRepository,
    unitOfWork,
    afterCommitPublisher,
    useCase,
  };
}

describe("PersistBatchNotificationUseCase — 배치 알림과 dispatch 원자 저장", () => {
  it("알림과 BATCH dispatch를 같은 UOW에 저장하고 커밋 후 발행 ID를 등록한다", async () => {
    // Given
    const {
      notificationRepository,
      pushDispatchRepository,
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
    expect(pushDispatchRepository.dispatches).toEqual([
      expect.objectContaining({
        id: 101,
        notificationId: 1,
        recipientId: "u1",
        deliveryMode: "BATCH",
        force: true,
      }),
      expect.objectContaining({
        id: 102,
        notificationId: 2,
        recipientId: "u2",
        deliveryMode: "BATCH",
        force: false,
      }),
    ]);
    expect(afterCommitPublisher.registered).toEqual([[101, 102]]);
  });

  it("SINGLE을 고르면 알림은 한 번에 넣고 dispatch는 단건 발송 경로로 둔다", async () => {
    // Given
    const { pushDispatchRepository, unitOfWork, useCase } = createPersistUseCase();
    const dataList = [
      createNotificationDraftFixture({ userId: "u1", type: "TODO_REMINDER" }),
      createNotificationDraftFixture({ userId: "u2", type: "TODO_REMINDER" }),
    ];

    // When
    await useCase.execute(dataList, { deliveryMode: "SINGLE" });

    // Then
    expect(unitOfWork.runCount).toBe(1);
    expect(pushDispatchRepository.dispatches.map((dispatch) => dispatch.deliveryMode)).toEqual([
      "SINGLE",
      "SINGLE",
    ]);
  });

  it("빈 입력은 UOW, DB, staging, 발행 등록을 모두 건너뛴다", async () => {
    // Given
    const {
      notificationRepository,
      pushDispatchRepository,
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
    expect(pushDispatchRepository.dispatches).toEqual([]);
    expect(afterCommitPublisher.registered).toEqual([]);
  });
});
