import { mock } from "vitest-mock-extended";

import type { JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import type { RebaseTodoTimezone } from "../../../application/use-cases/todos/rebase-todo-timezone.use-case.js";
import { TODO_TIMEZONE_REBASE_JOB_POLICY } from "./todo-timezone-rebase-queue.constants.js";
import { TodoTimezoneRebaseProcessor } from "./todo-timezone-rebase.processor.js";

const JOB = { name: "rebase-todo-timezone", data: { userId: "user-1" } };
const LAST_ATTEMPT = TODO_TIMEZONE_REBASE_JOB_POLICY.retryLimit + 1;

function createProcessor(execute = vi.fn<RebaseTodoTimezone["execute"]>()) {
  const raise = vi.fn();
  const processor = new TodoTimezoneRebaseProcessor({ execute }, { raise }, mock<JobRuntimePort>());
  return { processor, execute, raise };
}

describe("시간대 재계산 작업", () => {
  it("사용자 id만 넘겨 실행 때 최신 시간대를 읽게 한다", async () => {
    // Given
    const { processor, execute } = createProcessor();
    // When
    await processor.process(JOB, 1);
    // Then
    expect(execute).toHaveBeenCalledWith({ userId: "user-1" });
  });

  it("모양이 다른 작업은 재시도하지 않고 버린다", async () => {
    // Given
    const { processor, execute } = createProcessor();
    // When
    await processor.process({ name: "other" }, 1);
    // Then
    expect(execute).not.toHaveBeenCalled();
  });

  it("실패하면 다시 던져 재시도하고 재시도 중에는 경보를 올리지 않는다", async () => {
    // Given
    const failure = new Error("db");
    const { processor, raise } = createProcessor(vi.fn().mockRejectedValue(failure));
    // When
    const run = processor.process(JOB, 1);
    // Then
    await expect(run).rejects.toBe(failure);
    expect(raise).not.toHaveBeenCalled();
  });

  it("마지막 시도까지 실패하면 경보를 올린다", async () => {
    // Given
    const failure = new Error("db");
    const { processor, raise } = createProcessor(vi.fn().mockRejectedValue(failure));
    // When
    const run = processor.process(JOB, LAST_ATTEMPT);
    // Then
    await expect(run).rejects.toBe(failure);
    expect(raise).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "planning.todo-timezone-rebase-failed",
        severity: "error",
      }),
    );
  });
});
