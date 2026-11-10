import { createRetentionRepositoryMock, createUnitOfWorkMock } from "#test/mocks/ports/index";

import type { CreateNotificationData } from "../../../inbox/application/ports/notification-draft.port.js";
import { type RetentionStageCandidate } from "../ports/retention.repository.port.js";
import { ProcessRetentionStages } from "./process-retention-stages.use-case.js";

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

function setup(stages: readonly RetentionStageCandidate[], options: { claimed?: boolean } = {}) {
  const repository = createRetentionRepositoryMock();
  vi.mocked(repository.findScheduledStages).mockResolvedValue([...stages]);
  vi.mocked(repository.markStageOutboxed).mockResolvedValue(options.claimed ?? true);
  vi.mocked(repository.markStageSkipped).mockResolvedValue(true);
  const published: CreateNotificationData[] = [];
  const useCase = new ProcessRetentionStages({
    repository,
    notificationPublisher: {
      publish: async (data) => {
        published.push(data);
        return null;
      },
    },
    config: { enabled: true },
    unitOfWork: createUnitOfWorkMock(),
    logger: { debug: () => undefined, error: () => undefined },
  });
  return { useCase, repository, published };
}

describe("ProcessRetentionStages — 신규 코호트 단계 처리", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-16T10:30:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("적격 단계는 공용 알림 발행으로 ENGAGEMENT 푸시를 만든다", async () => {
    // Given
    const { useCase, repository, published } = setup([candidate()]);

    // When
    await useCase.execute();

    // Then
    expect(repository.markStageOutboxed).toHaveBeenCalledWith("stage-1");
    expect(published).toEqual([
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
    // Given
    const { useCase, published } = setup([candidate()], { claimed: false });

    // When
    await useCase.execute();

    // Then
    expect(published).toHaveLength(0);
  });

  it("CONTROL은 D7 결과만 기록하고 알림을 만들지 않는다", async () => {
    // Given
    const { useCase, repository, published } = setup([
      candidate({ variant: "CONTROL", stage: "D7", startedAt: new Date("2026-07-09T10:30:00Z") }),
    ]);

    // When
    await useCase.execute();

    // Then
    expect(repository.recordD7Result).toHaveBeenCalledWith({
      assignmentId: "assignment-1",
      returnedWithinD7: false,
      todoActionWithinD7: false,
    });
    expect(published).toHaveLength(0);
  });

  it("마케팅 동의가 없으면 알림 없이 단계만 건너뛴다", async () => {
    // Given
    const { useCase, repository, published } = setup([candidate({ marketingPushAgreedAt: null })]);

    // When
    await useCase.execute();

    // Then
    expect(repository.markStageSkipped).toHaveBeenCalledWith(
      "stage-1",
      "MARKETING_CONSENT_REQUIRED",
    );
    expect(published).toHaveLength(0);
  });
});
