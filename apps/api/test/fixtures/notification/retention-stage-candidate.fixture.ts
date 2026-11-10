import type { RetentionStageCandidate } from "#api/modules/notification/retention/application/read-models/retention-stage-candidate.read-model";

export function createRetentionStageCandidateFixture(
  overrides: Partial<RetentionStageCandidate> = {},
): RetentionStageCandidate {
  return {
    assignmentId: "assignment-1",
    stageId: "stage-1",
    stageCreatedAt: new Date("2026-07-15T10:30:00Z"),
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
