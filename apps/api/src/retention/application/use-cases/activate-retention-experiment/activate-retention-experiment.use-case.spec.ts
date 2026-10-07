import { TestBed } from "@suites/unit";
import { vi } from "vitest";
import type { Mocked } from "vitest";

import { UNIT_OF_WORK } from "#api/shared/application/ports/index";
import { createRetentionRepositoryMock, createUnitOfWorkMock } from "#test/mocks/ports/index";

import { RETENTION_CONFIG, type RetentionConfigPort } from "../../ports/retention-config.port.js";
import {
  RETENTION_REPOSITORY,
  type RetentionRepositoryPort,
} from "../../ports/retention.repository.port.js";
import { ActivateRetentionExperimentUseCase } from "./activate-retention-experiment.use-case.js";

describe("ActivateRetentionExperimentUseCase — 최초 인증 시점 시작", () => {
  let repository: Mocked<RetentionRepositoryPort>;

  async function build(enabled: boolean) {
    const compiled = await TestBed.solitary(ActivateRetentionExperimentUseCase)
      .mock<RetentionRepositoryPort>(RETENTION_REPOSITORY)
      .impl(() => createRetentionRepositoryMock())
      .mock<RetentionConfigPort>(RETENTION_CONFIG)
      .impl(() => ({ enabled, treatmentPercent: 50 }))
      .mock(UNIT_OF_WORK)
      .impl(() => createUnitOfWorkMock())
      .compile();
    repository = compiled.unitRef.get(RETENTION_REPOSITORY);
    return compiled.unit;
  }

  it("assignment가 있을 수 있는 활성 환경에서만 시작을 요청한다", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-07-15T00:00:00Z"));
    const useCase = await build(true);

    await useCase.execute("new-user");

    expect(repository.activate).toHaveBeenCalledWith("new-user", new Date("2026-07-15T00:00:00Z"));
    vi.useRealTimers();
  });

  it("kill switch가 꺼지면 기존 인증 경로에서 DB를 조회하지 않는다", async () => {
    const useCase = await build(false);

    await useCase.execute("existing-user");

    expect(repository.activate).not.toHaveBeenCalled();
  });
});
