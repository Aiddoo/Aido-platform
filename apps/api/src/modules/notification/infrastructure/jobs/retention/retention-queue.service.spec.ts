import { FakeJobRuntime } from "#test/mocks/fake-job-runtime";

import {
  RETENTION_QUEUE,
  RETENTION_STAGE_SWEEP_SCHEDULE,
  RetentionJobName,
} from "./retention-queue.constants.js";
import { RetentionQueueService } from "./retention-queue.service.js";

describe("RetentionQueueService — 리텐션 예약", () => {
  it("단계 sweep 예약만 등록한다", async () => {
    // Given
    const runtime = new FakeJobRuntime();
    const service = new RetentionQueueService(runtime);

    // When
    service.onModuleInit();
    await service.schedulerRegistration;

    // Then
    expect(runtime.scheduleCalls).toEqual([
      expect.objectContaining({
        scheduleKey: RETENTION_STAGE_SWEEP_SCHEDULE.key,
        cron: RETENTION_STAGE_SWEEP_SCHEDULE.cron,
        queue: RETENTION_QUEUE,
        data: { name: RetentionJobName.STAGE_SWEEP, data: {} },
      }),
    ]);
  });
});
