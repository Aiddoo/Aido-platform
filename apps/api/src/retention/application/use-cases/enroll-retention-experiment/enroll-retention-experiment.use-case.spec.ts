import { TestBed } from "@suites/unit";
import { vi } from "vitest";
import type { Mocked } from "vitest";

import { createRetentionRepositoryMock } from "#test/mocks/ports/index";

import { RETENTION_CONFIG, type RetentionConfigPort } from "../../ports/retention-config.port.js";
import {
  RETENTION_REPOSITORY,
  type RetentionRepositoryPort,
} from "../../ports/retention.repository.port.js";
import { EnrollRetentionExperimentUseCase } from "./enroll-retention-experiment.use-case.js";

describe("EnrollRetentionExperimentUseCase — 신규 사용자만 등록", () => {
  let repository: Mocked<RetentionRepositoryPort>;

  async function build(enabled: boolean) {
    const { unit, unitRef } = await TestBed.solitary(EnrollRetentionExperimentUseCase)
      .mock<RetentionRepositoryPort>(RETENTION_REPOSITORY)
      .impl(() => createRetentionRepositoryMock())
      .mock<RetentionConfigPort>(RETENTION_CONFIG)
      .impl(() => ({ enabled, treatmentPercent: 100 }))
      .compile();
    repository = unitRef.get(RETENTION_REPOSITORY);
    return unit;
  }

  it("kill switch가 꺼져 있으면 DB를 전혀 변경하지 않는다", async () => {
    const useCase = await build(false);

    await useCase.execute("existing-or-new-user", false);

    expect(repository.enroll).not.toHaveBeenCalled();
  });

  it("활성화된 신규 등록 요청은 안정적으로 TREATMENT를 저장한다", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-07-15T00:00:00Z"));
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
