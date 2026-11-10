import { TestBed } from "@suites/unit";

import { ProcessRetentionStages } from "../../application/use-cases/process-retention-stages.use-case.js";
import { RetentionJobName } from "./retention-queue.constants.js";
import { RetentionQueueProcessor } from "./retention-queue.processor.js";

describe("RetentionQueueProcessor — 리텐션 작업 처리", () => {
  it("단계 sweep 작업은 단계 처리로 넘기고 이전 배포가 남긴 발송 작업은 처리 없이 완료한다", async () => {
    // Given
    const { unit: processor, unitRef } = await TestBed.solitary(RetentionQueueProcessor).compile();
    const processStages = unitRef.get(ProcessRetentionStages);

    // When
    await processor.process({ name: "retention-dispatch", data: { outboxId: "outbox-1" } });
    await processor.process({ name: RetentionJobName.STAGE_SWEEP, data: {} });

    // Then
    expect(processStages.execute).toHaveBeenCalledTimes(1);
  });
});
