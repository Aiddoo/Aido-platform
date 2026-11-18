import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { RetentionAssignmentId } from "./retention-assignment-id.vo.js";
import { RetentionAssignment } from "./retention-assignment.aggregate.js";
import { RetentionD7Result } from "./retention-d7-result.vo.js";

const STARTED_AT = Temporal.Instant.from("2026-07-15T00:00:00Z");
const NOW = Temporal.Instant.from("2026-07-16T02:00:00Z");

function enrolled(startedAt: Temporal.Instant | null): RetentionAssignment {
  return RetentionAssignment.create({
    id: RetentionAssignmentId.reconstitute("assignment-1"),
    userId: UserId.reconstitute("user-1"),
    variant: "TREATMENT",
    startedAt,
  });
}

describe("RetentionAssignment", () => {
  it("시작 전 배정은 한 번만 시작하고 그때 네 단계를 만든다", () => {
    // Given
    const assignment = enrolled(null);
    assignment.pullChanges();

    // When
    const first = assignment.activate(STARTED_AT);
    const second = assignment.activate(NOW);

    // Then
    expect([first, second]).toEqual([true, false]);
    expect(assignment.startedAt).toEqual(STARTED_AT);
    expect(assignment.stages.map((stage) => stage.stage)).toEqual(["D0", "D1", "D3", "D7"]);
    expect(assignment.pullChanges()).toEqual([{ kind: "ACTIVATED" }]);
  });

  it("단계는 SCHEDULED에서 한 번만 닫히고 닫힌 변경만 저장할 것으로 남긴다", () => {
    // Given
    const assignment = enrolled(STARTED_AT);
    assignment.pullChanges();
    const [d0] = assignment.stages;
    if (d0 == null) {
      throw new Error("stage fixture 누락");
    }

    // When
    const skipped = assignment.skipStage(d0.id.value, "TEST_SKIP", NOW);
    const outboxed = assignment.outboxStage(d0.id.value, NOW);

    // Then
    expect([skipped, outboxed]).toEqual([true, false]);
    expect(d0.status).toBe("SKIPPED");
    expect(assignment.pullChanges().map((change) => change.kind)).toEqual(["STAGE_CLOSED"]);
    expect(assignment.pullChanges()).toEqual([]);
  });

  it("처리가 실패해 버린 변경은 다음 저장에 섞이지 않는다", () => {
    // Given
    const assignment = enrolled(STARTED_AT);
    assignment.pullChanges();
    assignment.measureD7(
      RetentionD7Result.create({
        returnedWithinD7: true,
        todoActionWithinD7: false,
        measuredAt: NOW,
      }),
    );

    // When
    assignment.discardChanges();

    // Then
    expect(assignment.pullChanges()).toEqual([]);
  });

  it("배정에 없는 단계에 알림을 이으면 실패한다", () => {
    // Given
    const assignment = enrolled(STARTED_AT);

    // When
    const linking = () => assignment.linkStageNotification("missing-stage", 1, NOW);

    // Then
    expect(linking).toThrow();
  });
});
