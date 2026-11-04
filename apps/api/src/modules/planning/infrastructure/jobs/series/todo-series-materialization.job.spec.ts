import { vi } from "vitest";

import { FakeJobRuntime } from "#test/mocks/fake-job-runtime";

import { TodoSeriesMaterializationJob } from "./todo-series-materialization.job.js";
import {
  TODO_SERIES_MATERIALIZATION_QUEUE,
  TODO_SERIES_MATERIALIZATION_SCHEDULE,
} from "./todo-series-materialization.queue.constants.js";

describe("TodoSeriesMaterializationJob — 매일 스케줄과 놓친 실행 따라잡기", () => {
  let runtime: FakeJobRuntime;
  let job: TodoSeriesMaterializationJob;

  beforeEach(() => {
    vi.useFakeTimers();
    runtime = new FakeJobRuntime();
    job = new TodoSeriesMaterializationJob(runtime);
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    { at: "2026-12-31T18:09:59.999Z", key: undefined },
    { at: "2026-12-31T18:10:00.000Z", key: "materialize_series_2027-01-01" },
    { at: "2027-01-01T14:59:59.999Z", key: "materialize_series_2027-01-01" },
  ])("KST 03:10 경계 $at에서 스케줄을 등록하고 실행일 키로 따라잡는다", async ({ at, key }) => {
    // Given
    vi.setSystemTime(new Date(at));
    // When
    job.onModuleInit();
    await job.schedulerRegistration;
    // Then
    expect(runtime.scheduleCalls).toEqual([
      expect.objectContaining({
        scheduleKey: TODO_SERIES_MATERIALIZATION_SCHEDULE.id,
        cron: "10 3 * * *",
        queue: TODO_SERIES_MATERIALIZATION_QUEUE,
      }),
    ]);
    expect(runtime.enqueueCalls.map((call) => call.options.idempotencyKey)).toEqual(
      key == null ? [] : [key],
    );
  });
});
