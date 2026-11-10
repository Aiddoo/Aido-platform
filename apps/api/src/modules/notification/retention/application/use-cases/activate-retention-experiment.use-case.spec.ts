import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { createRetentionRepositoryMock, createUnitOfWorkMock } from "#test/mocks/ports/index";

import { ActivateRetentionExperiment } from "./activate-retention-experiment.use-case.js";

describe("ActivateRetentionExperiment — 최초 인증 시점 시작", () => {
  let repository: Mocked<
    ConstructorParameters<typeof ActivateRetentionExperiment>[0]["repository"]
  >;

  async function build(enabled: boolean) {
    const activateRetentionExperimentDependencies = mockDeep<
      ConstructorParameters<typeof ActivateRetentionExperiment>[0]
    >({
      repository: createRetentionRepositoryMock(),
      config: { enabled },
      unitOfWork: createUnitOfWorkMock(),
    });
    const unit = new ActivateRetentionExperiment(activateRetentionExperimentDependencies);
    repository = activateRetentionExperimentDependencies.repository;
    return unit;
  }

  it("assignment가 있을 수 있는 활성 환경에서만 시작을 요청한다", async () => {
    vi.useFakeTimers({ toFake: ["Date"] }).setSystemTime(new Date("2026-07-15T00:00:00Z"));
    try {
      const useCase = await build(true);

      await useCase.execute("new-user");

      expect(repository.activate).toHaveBeenCalledWith(
        "new-user",
        new Date("2026-07-15T00:00:00Z"),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("kill switch가 꺼지면 기존 인증 경로에서 DB를 조회하지 않는다", async () => {
    const useCase = await build(false);

    await useCase.execute("existing-user");

    expect(repository.activate).not.toHaveBeenCalled();
  });
});
