import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { createRetentionRepositoryMock } from "#test/mocks/ports/index";

import { EnrollRetentionExperiment } from "./enroll-retention-experiment.use-case.js";

describe("EnrollRetentionExperiment — 신규 사용자만 등록", () => {
  let repository: Mocked<ConstructorParameters<typeof EnrollRetentionExperiment>[0]["repository"]>;

  async function build(enabled: boolean) {
    const enrollRetentionExperimentDependencies = mockDeep<
      ConstructorParameters<typeof EnrollRetentionExperiment>[0]
    >({ repository: createRetentionRepositoryMock(), config: { enabled, treatmentPercent: 100 } });
    const unit = new EnrollRetentionExperiment(enrollRetentionExperimentDependencies);
    repository = enrollRetentionExperimentDependencies.repository;
    return unit;
  }

  it("kill switch가 꺼져 있으면 DB를 전혀 변경하지 않는다", async () => {
    const useCase = await build(false);

    await useCase.execute("existing-or-new-user", false);

    expect(repository.enroll).not.toHaveBeenCalled();
  });

  it("활성화된 신규 등록 요청은 안정적으로 TREATMENT를 저장한다", async () => {
    vi.useFakeTimers({ toFake: ["Date"] }).setSystemTime(new Date("2026-07-15T00:00:00Z"));
    const useCase = await build(true);

    await useCase.execute("new-user", true);

    expect(repository.enroll).toHaveBeenCalledWith({
      userId: "new-user",
      variant: "TREATMENT",
      startedAt: new Date("2026-07-15T00:00:00Z"),
    });
    vi.useRealTimers();
  });
});
