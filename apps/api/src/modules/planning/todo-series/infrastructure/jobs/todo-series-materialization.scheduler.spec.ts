import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";

import { TODO_SERIES_MATERIALIZATION_QUEUE } from "./todo-series-materialization.queue.js";
import { TodoSeriesMaterializationScheduler } from "./todo-series-materialization.scheduler.js";

describe("TodoSeriesMaterializationScheduler — 매일 스케줄과 놓친 실행 따라잡기", () => {
  it.each([
    { at: "2026-12-31T18:09:59.999Z", key: undefined },
    { at: "2026-12-31T18:10:00.000Z", key: "materialize_series_2027-01-01" },
    { at: "2027-01-01T14:59:59.999Z", key: "materialize_series_2027-01-01" },
  ])("KST 03:10 경계 $at에서 스케줄을 등록하고 실행일 키로 따라잡는다", async ({ at, key }) => {
    // Given
    const jobQueue = new InMemoryJobQueue();
    const scheduler = new TodoSeriesMaterializationScheduler(
      jobQueue,
      new FixedClock(Temporal.Instant.from(at)),
    );

    // When
    scheduler.onModuleInit();
    await scheduler.schedulerRegistration;

    // Then
    expect(jobQueue.scheduledQueues).toEqual(["todo-series-materialization.v1"]);
    expect(
      jobQueue.jobsIn(TODO_SERIES_MATERIALIZATION_QUEUE).map((job) => job.options.idempotencyKey),
    ).toEqual(key == null ? [] : [key]);
  });
});
