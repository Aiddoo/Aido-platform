import { groupBy } from "es-toolkit";

import type {
  retentionExperimentAssignment,
  retentionExperimentStage,
} from "#api/platform/database/schema/index";

import { RetentionAssignment } from "../../domain/retention-assignment.aggregate.js";

interface RetentionAssignmentJoinRow {
  readonly assignment: typeof retentionExperimentAssignment.$inferSelect;
  readonly stage: typeof retentionExperimentStage.$inferSelect | null;
}

// 배정 한 행에 단계가 0~4행 붙은 조인 결과를 배정마다 묶는다
export function toRetentionAssignments(
  rows: readonly RetentionAssignmentJoinRow[],
): RetentionAssignment[] {
  return Object.values(groupBy(rows, (row) => row.assignment.id)).flatMap((assignmentRows) => {
    const [first] = assignmentRows;
    if (first == null) {
      return [];
    }
    const { assignment } = first;
    return [
      RetentionAssignment.reconstitute({
        id: assignment.id,
        userId: assignment.userId,
        variant: assignment.variant,
        startedAt: assignment.startedAt,
        stages: assignmentRows.flatMap(({ stage }) =>
          stage == null
            ? []
            : [
                {
                  id: stage.id,
                  stage: stage.stage,
                  status: stage.status,
                  skipReason: stage.skipReason,
                  processedAt: stage.processedAt,
                  notificationId: stage.notificationId,
                  updatedAt: stage.updatedAt,
                },
              ],
        ),
      }),
    ];
  });
}
