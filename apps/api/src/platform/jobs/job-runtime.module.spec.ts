import { vi } from "vitest";

import type { JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import { JobRuntimeLifecycle } from "./job-runtime.module.js";

function createRuntime(): JobRuntimePort {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    enqueue: vi.fn(),
    enqueueMany: vi.fn(),
    schedule: vi.fn(),
    unschedule: vi.fn(),
    cancel: vi.fn(),
    work: vi.fn(),
    health: vi.fn(),
  };
}

describe("JobRuntimeLifecycle — 작업 runtime 수명주기", () => {
  it("애플리케이션 시작과 종료를 작업 runtime에 위임한다", async () => {
    // Given
    const runtime = createRuntime();
    const lifecycle = new JobRuntimeLifecycle(runtime);

    // When
    await lifecycle.onApplicationBootstrap();
    await lifecycle.beforeApplicationShutdown();

    // Then
    expect(runtime.start).toHaveBeenCalledTimes(1);
    expect(runtime.stop).toHaveBeenCalledTimes(1);
  });
});
