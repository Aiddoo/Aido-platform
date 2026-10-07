import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { createRetentionRepositoryMock, createUnitOfWorkMock } from "#test/mocks/ports/index";

import {
  type RetentionRepositoryPort,
  type RetentionStageCandidate,
} from "../../ports/retention/retention.repository.port.js";
import { ProcessRetentionStages } from "./process-retention-stages.use-case.js";

describe("ProcessRetentionStages — 신규 코호트 단계 처리", () => {
  let useCase: ProcessRetentionStages;
  let repository: Mocked<RetentionRepositoryPort>;

  beforeEach(async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-07-16T10:30:00Z"));
    const processRetentionStagesDependencies = mockDeep<
      ConstructorParameters<typeof ProcessRetentionStages>[0]
    >({
      repository: createRetentionRepositoryMock(),
      config: { enabled: true, treatmentPercent: 50 },
      unitOfWork: createUnitOfWorkMock(),
    });
    const unit = new ProcessRetentionStages(processRetentionStagesDependencies);
    useCase = unit;
    repository = processRetentionStagesDependencies.repository;
  });

  afterEach(() => vi.useRealTimers());

  function candidate(overrides: Partial<RetentionStageCandidate> = {}): RetentionStageCandidate {
    return {
      assignmentId: "assignment-1",
      stageId: "stage-1",
      userId: "new-user",
      variant: "TREATMENT",
      stage: "D1",
      startedAt: new Date("2026-07-15T10:30:00Z"),
      timezone: "UTC",
      locale: "ko",
      pushEnabled: true,
      nightPushEnabled: false,
      marketingPushAgreedAt: new Date("2026-07-15T00:00:00Z"),
      activeTokenCount: 1,
      lastActiveAt: null,
      todoCount: 0,
      completedCount: 0,
      incompleteCount: 0,
      todoActionWithinWindow: false,
      ...overrides,
    };
  }

  it("TREATMENT의 적격 단계만 Notification/outbox 생성 포트로 전달한다", async () => {
    repository.findScheduledStages.mockResolvedValue([candidate()]);
    repository.createDelivery.mockResolvedValue(true);

    await useCase.execute();

    expect(repository.createDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        stageId: "stage-1",
        userId: "new-user",
        route: "/feed",
        variantId: expect.stringMatching(/^d1_no_todo\.v[1-3]$/),
      }),
    );
  });

  it("CONTROL은 D7 결과만 기록하고 알림을 만들지 않는다", async () => {
    repository.findScheduledStages.mockResolvedValue([
      candidate({
        variant: "CONTROL",
        stage: "D7",
        startedAt: new Date("2026-07-09T10:30:00Z"),
      }),
    ]);

    await useCase.execute();

    expect(repository.recordD7Result).toHaveBeenCalledWith({
      assignmentId: "assignment-1",
      returnedWithinD7: false,
      todoActionWithinD7: false,
    });
    expect(repository.createDelivery).not.toHaveBeenCalled();
  });

  it("마케팅 동의가 없으면 Notification 없이 단계만 스킵한다", async () => {
    repository.findScheduledStages.mockResolvedValue([candidate({ marketingPushAgreedAt: null })]);

    await useCase.execute();

    expect(repository.markStageSkipped).toHaveBeenCalledWith(
      "stage-1",
      "MARKETING_CONSENT_REQUIRED",
    );
    expect(repository.createDelivery).not.toHaveBeenCalled();
  });
});
