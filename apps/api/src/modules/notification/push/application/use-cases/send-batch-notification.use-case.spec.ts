import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingAfterCommitRegistry } from "#test/doubles/platform/recording-after-commit-registry";
import { createNotificationDraftFixture } from "#test/fixtures/notification/notification.fixture";

import type { CreateNotificationData } from "../../../inbox/application/ports/notification-draft.port.js";
import type { PersistedBatchNotificationResult } from "../read-models/push-delivery.read-model.js";
import type { FinalizeBatchNotificationUseCase } from "./finalize-batch-notification.use-case.js";
import type { PersistBatchNotificationUseCase } from "./persist-batch-notification.use-case.js";
import { SendBatchNotificationUseCase } from "./send-batch-notification.use-case.js";

class StubPersistBatch implements Pick<PersistBatchNotificationUseCase, "execute"> {
  result: (dataList: CreateNotificationData[]) => Promise<PersistedBatchNotificationResult> =
    async (dataList) => ({ count: dataList.length, sourceData: dataList });

  execute(dataList: CreateNotificationData[]): Promise<PersistedBatchNotificationResult> {
    return this.result(dataList);
  }
}

class RecordingFinalizeBatch implements Pick<FinalizeBatchNotificationUseCase, "execute"> {
  readonly finalized: PersistedBatchNotificationResult[] = [];

  async execute(input: PersistedBatchNotificationResult): Promise<{ count: number }> {
    this.finalized.push(input);
    return { count: input.count };
  }
}

function createSendBatchUseCase() {
  const persistBatch = new StubPersistBatch();
  const finalizeBatch = new RecordingFinalizeBatch();
  const afterCommitTasks = new RecordingAfterCommitRegistry();
  const useCase = new SendBatchNotificationUseCase({
    persistBatchNotificationUseCase: persistBatch,
    finalizeBatchNotificationUseCase: finalizeBatch,
    unitOfWork: new ImmediateUnitOfWork(),
    afterCommitTasks,
  });
  return { persistBatch, finalizeBatch, afterCommitTasks, useCase };
}

describe("SendBatchNotificationUseCase — 배치 알림의 커밋 후 정리", () => {
  it("외부 트랜잭션이 진행 중이면 정리를 예약하고 커밋 후에만 실행한다", async () => {
    // Given
    const { finalizeBatch, afterCommitTasks, useCase } = createSendBatchUseCase();
    const dataList = [createNotificationDraftFixture({ userId: "u1" })];

    // When
    const result = await useCase.execute(dataList);

    // Then
    expect(result).toEqual({ count: 1 });
    expect(finalizeBatch.finalized).toEqual([]);
    expect(afterCommitTasks.tasks).toHaveLength(1);
    await afterCommitTasks.runAll();
    expect(finalizeBatch.finalized).toEqual([{ count: 1, sourceData: dataList }]);
  });

  it("저장이 실패하면 캐시와 날짜 중복 기록을 갱신하지 않는다", async () => {
    // Given
    const { persistBatch, finalizeBatch, afterCommitTasks, useCase } = createSendBatchUseCase();
    persistBatch.result = async () => {
      throw new Error("DB 저장 실패");
    };

    // When
    const result = useCase.execute([createNotificationDraftFixture()]);

    // Then
    await expect(result).rejects.toThrow("DB 저장 실패");
    expect(afterCommitTasks.tasks).toHaveLength(0);
    expect(finalizeBatch.finalized).toEqual([]);
  });

  it("중복 알림만 들어와 생성된 알림이 없으면 후처리를 예약하지 않는다", async () => {
    // Given
    const { persistBatch, afterCommitTasks, useCase } = createSendBatchUseCase();
    persistBatch.result = async () => ({ count: 0, sourceData: [] });

    // When
    const result = await useCase.execute([createNotificationDraftFixture()]);

    // Then
    expect(result).toEqual({ count: 0 });
    expect(afterCommitTasks.tasks).toHaveLength(0);
  });
});
