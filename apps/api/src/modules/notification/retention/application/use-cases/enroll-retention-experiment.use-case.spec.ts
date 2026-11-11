import { InMemoryRetentionRepository } from "#test/doubles/notification/in-memory-retention.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";

import {
  ExperimentAssignerPort,
  type ExperimentAssignment,
} from "../ports/experiment-assigner.port.js";
import { EnrollRetentionExperimentUseCase } from "./enroll-retention-experiment.use-case.js";

const NOW = Temporal.Instant.from("2026-07-15T00:00:00Z");

// 비중이 있는 첫 실험군을 고르고 받은 배정 요청을 남긴다
class FirstWeightedExperimentAssigner extends ExperimentAssignerPort {
  readonly assignments: ExperimentAssignment<string>[] = [];

  assign<TVariant extends string>(assignment: ExperimentAssignment<TVariant>): TVariant {
    this.assignments.push(assignment);
    const variant = assignment.variants.find(({ weight }) => weight > 0);
    if (variant == null) {
      throw new Error("no weighted variant");
    }
    return variant.key;
  }
}

function setup(config: { readonly enabled: boolean; readonly treatmentPercent: number }) {
  const repository = new InMemoryRetentionRepository();
  const experimentAssigner = new FirstWeightedExperimentAssigner();
  const useCase = new EnrollRetentionExperimentUseCase({
    repository,
    config,
    experimentAssigner,
    clock: new FixedClock(NOW),
  });
  return { useCase, repository, experimentAssigner };
}

describe("EnrollRetentionExperimentUseCase — 신규 사용자만 등록", () => {
  it("kill switch가 꺼져 있으면 DB를 전혀 변경하지 않는다", async () => {
    // Given
    const { useCase, repository } = setup({ enabled: false, treatmentPercent: 100 });

    // When
    await useCase.execute("existing-or-new-user", false);

    // Then
    expect(repository.enrollments).toEqual([]);
  });

  it("사용자를 리텐션 실험 key로 처리군이 앞 구간인 비율에 배정한다", async () => {
    // Given
    const { useCase, experimentAssigner } = setup({ enabled: true, treatmentPercent: 30 });

    // When
    await useCase.execute("new-user", false);

    // Then
    expect(experimentAssigner.assignments).toEqual([
      {
        experimentKey: "onboarding_v2_d7",
        subjectId: "new-user",
        variants: [
          { key: "TREATMENT", weight: 30 },
          { key: "CONTROL", weight: 70 },
        ],
      },
    ]);
  });

  it("활성화된 신규 등록 요청은 안정적으로 TREATMENT를 저장한다", async () => {
    // Given
    const { useCase, repository } = setup({ enabled: true, treatmentPercent: 100 });

    // When
    await useCase.execute("new-user", true);

    // Then
    expect(repository.enrollments).toEqual([
      {
        userId: "new-user",
        variant: "TREATMENT",
        startedAt: Temporal.Instant.from("2026-07-15T00:00:00Z"),
      },
    ]);
  });

  it("처리 비율이 0이면 인증 전 사용자도 CONTROL로 시작 시각 없이 등록한다", async () => {
    // Given
    const { useCase, repository } = setup({ enabled: true, treatmentPercent: 0 });

    // When
    await useCase.execute("new-user", false);

    // Then
    expect(repository.enrollments).toEqual([
      { userId: "new-user", variant: "CONTROL", startedAt: null },
    ]);
  });
});
