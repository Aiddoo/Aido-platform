import { InMemoryRetentionRepository } from "#test/doubles/notification/in-memory-retention.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";

import { ActivateRetentionExperimentUseCase } from "./activate-retention-experiment.use-case.js";

const NOW = Temporal.Instant.from("2026-07-15T00:00:00Z");

async function setup(enabled: boolean) {
  const repository = new InMemoryRetentionRepository();
  await repository.enroll({ userId: "new-user", variant: "TREATMENT", startedAt: null });
  const unitOfWork = new ImmediateUnitOfWork();
  const useCase = new ActivateRetentionExperimentUseCase({
    repository,
    config: { enabled },
    unitOfWork,
    clock: new FixedClock(NOW),
  });
  return { useCase, repository, unitOfWork };
}

describe("ActivateRetentionExperimentUseCase — 최초 인증 시점 시작", () => {
  it("assignment가 있을 수 있는 활성 환경에서만 시작을 요청한다", async () => {
    // Given
    const { useCase, repository } = await setup(true);

    // When
    await useCase.execute("new-user");

    // Then
    expect(repository.enrollments).toEqual([
      {
        userId: "new-user",
        variant: "TREATMENT",
        startedAt: Temporal.Instant.from("2026-07-15T00:00:00Z"),
      },
    ]);
  });

  it("kill switch가 꺼지면 기존 인증 경로에서 DB를 조회하지 않는다", async () => {
    // Given
    const { useCase, repository, unitOfWork } = await setup(false);

    // When
    await useCase.execute("existing-user");

    // Then
    expect(unitOfWork.runCount).toBe(0);
    expect(repository.enrollments[0]?.startedAt).toBeNull();
  });
});
