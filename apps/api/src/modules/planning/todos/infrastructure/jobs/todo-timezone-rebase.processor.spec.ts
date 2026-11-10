import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";

import type { RebaseTodoTimezoneUseCase } from "../../application/use-cases/rebase-todo-timezone.use-case.js";
import { TodoTimezoneRebaseProcessor } from "./todo-timezone-rebase.processor.js";
import {
  TODO_TIMEZONE_REBASE_QUEUE,
  toTodoTimezoneRebasePayload,
} from "./todo-timezone-rebase.queue.js";

const PAYLOAD = toTodoTimezoneRebasePayload("user-1");
const LAST_ATTEMPT = TODO_TIMEZONE_REBASE_QUEUE.retry.retryLimit + 1;

class FailingRebase implements Pick<RebaseTodoTimezoneUseCase, "execute"> {
  readonly failure = new Error("db");

  async execute(): ReturnType<RebaseTodoTimezoneUseCase["execute"]> {
    throw this.failure;
  }
}

function createProcessor(rebase: FailingRebase) {
  const alert = new RecordingOperationalAlert();
  const processor = new TodoTimezoneRebaseProcessor(rebase, alert, new InMemoryJobQueue());
  return { processor, alert };
}

describe("시간대 재계산 작업", () => {
  it("실패하면 다시 던져 재시도하고 재시도 중에는 경보를 올리지 않는다", async () => {
    // Given
    const rebase = new FailingRebase();
    const { processor, alert } = createProcessor(rebase);

    // When
    const run = processor.process(PAYLOAD, 1);

    // Then
    await expect(run).rejects.toBe(rebase.failure);
    expect(alert.alerts).toEqual([]);
  });

  it("마지막 시도까지 실패하면 경보를 올린다", async () => {
    // Given
    const rebase = new FailingRebase();
    const { processor, alert } = createProcessor(rebase);

    // When
    const run = processor.process(PAYLOAD, LAST_ATTEMPT);

    // Then
    await expect(run).rejects.toBe(rebase.failure);
    expect(alert.alerts).toEqual([
      expect.objectContaining({
        key: "planning.todo-timezone-rebase-failed",
        severity: "error",
        details: { userId: "user-1", attempt: LAST_ATTEMPT, errorType: "Error" },
      }),
    ]);
  });
});
