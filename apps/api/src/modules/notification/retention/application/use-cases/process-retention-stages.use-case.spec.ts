import { InMemoryRetentionRepository } from "#test/doubles/notification/in-memory-retention.repository";
import { RecordingNotificationPublisher } from "#test/doubles/notification/recording-notification-publisher";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createRetentionStageCandidateFixture as candidate } from "#test/fixtures/notification/retention-stage-candidate.fixture";

import type { RetentionStageCandidate } from "../read-models/retention-stage-candidate.read-model.js";
import {
  ProcessRetentionStagesUseCase,
  RETENTION_STAGE_SWEEP,
} from "./process-retention-stages.use-case.js";

const NOW = Temporal.Instant.from("2026-07-16T10:30:00Z");

function setup(stages: readonly RetentionStageCandidate[]) {
  const repository = new InMemoryRetentionRepository(stages);
  const publisher = new RecordingNotificationPublisher();
  const clock = new FixedClock(NOW);
  const logger = new SilentLogger();
  const useCase = new ProcessRetentionStagesUseCase({
    repository,
    notificationPublisher: publisher,
    config: { enabled: true },
    unitOfWork: new ImmediateUnitOfWork(),
    clock,
    logger,
  });
  return { useCase, repository, publisher, clock, logger };
}

function dueD1Stages(count: number): RetentionStageCandidate[] {
  return Array.from({ length: count }, (_, index) =>
    candidate({
      stageId: `stage-${String(index).padStart(4, "0")}`,
      userId: `user-${index}`,
      stageCreatedAt: Temporal.Instant.from("2026-07-15T10:30:00Z").add({ milliseconds: index }),
    }),
  );
}

describe("ProcessRetentionStagesUseCase — 신규 코호트 단계 처리", () => {
  it("적격 단계는 공용 알림 발행으로 ENGAGEMENT 푸시를 만든다", async () => {
    // Given
    const { useCase, repository, publisher } = setup([candidate()]);

    // When
    await useCase.execute();

    // Then
    expect(repository.stage("stage-1")).toMatchObject({
      status: "OUTBOXED",
      processedAt: Temporal.Instant.from("2026-07-16T10:30:00Z"),
    });
    expect(publisher.published.map(({ data }) => data)).toEqual([
      expect.objectContaining({
        userId: "new-user",
        type: "SYSTEM_NOTICE",
        purpose: "ENGAGEMENT",
        action: { type: "DEEP_LINK", url: "/feed" },
        variantId: expect.stringMatching(/^d1_no_todo\.v[1-3]$/),
      }),
    ]);
  });

  it("다른 실행이 먼저 단계를 처리했으면 알림을 만들지 않는다", async () => {
    // Given: 후보로 읽은 뒤 표시하기 전에 다른 실행이 먼저 표시했다
    const { useCase, repository, publisher } = setup([candidate()]);
    repository.markStageOutboxed = async () => false;

    // When
    await useCase.execute();

    // Then
    expect(publisher.published).toHaveLength(0);
  });

  it("CONTROL은 D7 결과만 기록하고 알림을 만들지 않는다", async () => {
    // Given
    const { useCase, repository, publisher } = setup([
      candidate({
        variant: "CONTROL",
        stage: "D7",
        startedAt: Temporal.Instant.from("2026-07-09T10:30:00Z"),
      }),
    ]);

    // When
    await useCase.execute();

    // Then
    expect(repository.d7Results.get("assignment-1")).toEqual({
      returnedWithinD7: false,
      todoActionWithinD7: false,
      measuredAt: Temporal.Instant.from("2026-07-16T10:30:00Z"),
    });
    expect(publisher.published).toHaveLength(0);
  });

  it("마케팅 동의가 없으면 알림 없이 단계만 건너뛴다", async () => {
    // Given
    const { useCase, repository, publisher } = setup([candidate({ marketingPushAgreedAt: null })]);

    // When
    await useCase.execute();

    // Then
    expect(repository.stage("stage-1")).toMatchObject({
      status: "SKIPPED",
      skipReason: "MARKETING_CONSENT_REQUIRED",
    });
    expect(publisher.published).toHaveLength(0);
  });

  it("5분 간격 실행 사이에 결정할 때가 된 단계는 다음 실행이 빠짐없이 처리한다", async () => {
    // Given: 10:30 실행 뒤 10:31·10:34에 D0 2시간이 차는 사용자와 몇 시간 전에 이미 찼던 사용자
    const { useCase, repository, publisher, clock } = setup([
      candidate({
        stageId: "due-at-1031",
        stage: "D0",
        startedAt: Temporal.Instant.from("2026-07-16T08:31:00Z"),
      }),
      candidate({
        stageId: "due-at-1034",
        stage: "D0",
        startedAt: Temporal.Instant.from("2026-07-16T08:34:00Z"),
      }),
      candidate({
        stageId: "overdue",
        stage: "D0",
        startedAt: Temporal.Instant.from("2026-07-16T05:00:00Z"),
      }),
    ]);
    await useCase.execute();
    const afterFirstRun = publisher.published.length;

    // When
    clock.advanceBy({ minutes: 5 });
    await useCase.execute();

    // Then
    expect(afterFirstRun).toBe(1);
    expect(
      ["due-at-1031", "due-at-1034", "overdue"].map((id) => repository.stage(id).status),
    ).toEqual(["OUTBOXED", "OUTBOXED", "OUTBOXED"]);
    expect(publisher.published).toHaveLength(3);
  });

  it("한 묶음이 가득 차면 다음 묶음을 이어 읽어 한 실행에서 밀린 단계를 모두 처리한다", async () => {
    // Given
    const total = RETENTION_STAGE_SWEEP.BATCH_SIZE * 2 + 5;
    const { useCase, repository, publisher } = setup(dueD1Stages(total));

    // When
    await useCase.execute();

    // Then
    expect(publisher.published).toHaveLength(total);
    expect(repository.dueQueries).toHaveLength(3);
  });

  it("처리에 실패한 단계는 같은 실행에서 다시 읽지 않고 다음 실행에 남긴다", async () => {
    // Given: 첫 묶음 전체가 실패하고 그 뒤에 처리할 단계가 하나 있다
    const stages = dueD1Stages(RETENTION_STAGE_SWEEP.BATCH_SIZE + 1);
    const { useCase, repository, publisher, logger } = setup(stages);
    repository.failingStageIds = new Set(
      stages.slice(0, RETENTION_STAGE_SWEEP.BATCH_SIZE).map(({ stageId }) => stageId),
    );

    // When
    await useCase.execute();

    // Then
    expect(repository.dueQueries).toHaveLength(2);
    expect(publisher.published).toHaveLength(1);
    expect(repository.stage("stage-0000").status).toBe("SCHEDULED");
    expect(logger.messages).toHaveLength(RETENTION_STAGE_SWEEP.BATCH_SIZE + 1);
  });
});
