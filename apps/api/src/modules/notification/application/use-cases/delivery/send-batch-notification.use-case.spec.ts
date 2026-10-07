import { vi, type Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { type AfterCommitTask } from "#api/shared/application/ports/index";
import { createUnitOfWorkMock } from "#test/mocks/ports/unit-of-work.mock";

import type { CreateNotificationData } from "../../ports/delivery/notification-data.js";
import { SendBatchNotification } from "./send-batch-notification.use-case.js";

describe("배치 알림의 커밋 후 정리", () => {
  let useCase: SendBatchNotification;
  let persistBatch: Mocked<
    ConstructorParameters<typeof SendBatchNotification>[0]["persistBatchNotificationUseCase"]
  >;
  let finalizeBatch: Mocked<
    ConstructorParameters<typeof SendBatchNotification>[0]["finalizeBatchNotificationUseCase"]
  >;
  let afterCommitTasks: AfterCommitTask[];

  beforeEach(async () => {
    afterCommitTasks = [];
    const sendBatchNotificationDependencies = mockDeep<
      ConstructorParameters<typeof SendBatchNotification>[0]
    >({
      unitOfWork: createUnitOfWorkMock(),
      afterCommitTasks: {
        register: vi.fn((task: AfterCommitTask) => {
          afterCommitTasks.push(task);
        }),
      },
    });
    const unit = new SendBatchNotification(sendBatchNotificationDependencies);
    useCase = unit;
    persistBatch = sendBatchNotificationDependencies.persistBatchNotificationUseCase;
    finalizeBatch = sendBatchNotificationDependencies.finalizeBatchNotificationUseCase;
  });

  it("외부 트랜잭션이 진행 중이면 정리를 예약하고 커밋 후에만 실행한다", async () => {
    // Given
    const dataList: CreateNotificationData[] = [
      { userId: "u1", type: "FOLLOW_NEW", title: "t", body: "b" },
    ];
    const persisted = { count: 1, sourceData: dataList };
    persistBatch.execute.mockResolvedValue(persisted);
    finalizeBatch.execute.mockResolvedValue({ count: 1 });

    // When
    const result = await useCase.execute(dataList);

    // Then
    expect(result).toEqual({ count: 1 });
    expect(finalizeBatch.execute).not.toHaveBeenCalled();
    expect(afterCommitTasks).toHaveLength(1);
    for (const task of afterCommitTasks) await task();
    expect(finalizeBatch.execute).toHaveBeenCalledWith(persisted);
  });

  it("저장이 실패하면 캐시와 날짜 중복 기록을 갱신하지 않는다", async () => {
    // Given
    persistBatch.execute.mockRejectedValue(new Error("DB 저장 실패"));

    // When
    const result = useCase.execute([]);

    // Then
    await expect(result).rejects.toThrow("DB 저장 실패");
    expect(afterCommitTasks).toHaveLength(0);
    expect(finalizeBatch.execute).not.toHaveBeenCalled();
  });

  it("중복 알림만 들어와 생성된 알림이 없으면 후처리를 예약하지 않는다", async () => {
    // Given
    persistBatch.execute.mockResolvedValue({ count: 0, sourceData: [] });

    // When
    const result = await useCase.execute([]);

    // Then
    expect(result).toEqual({ count: 0 });
    expect(afterCommitTasks).toHaveLength(0);
  });
});
