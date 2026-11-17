import type { RetentionAssignmentRepositoryPort } from "#api/modules/notification/retention-assignments/application/ports/retention-assignment.repository.port";
import { RetentionAssignmentId } from "#api/modules/notification/retention-assignments/domain/retention-assignment-id.vo";
import { RetentionAssignment } from "#api/modules/notification/retention-assignments/domain/retention-assignment.aggregate";
import type { RetentionVariant } from "#api/modules/notification/retention-assignments/domain/retention-assignments.constants";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 등록 UseCase와 같은 모양으로 배정을 저장한다. 이미 배정된 사용자면 false다
export function enrollRetentionAssignment(
  repository: Pick<RetentionAssignmentRepositoryPort, "save">,
  params: {
    readonly userId: string;
    readonly variant: RetentionVariant;
    readonly startedAt: Temporal.Instant | null;
  },
): Promise<boolean> {
  return repository.save(
    RetentionAssignment.create({
      id: RetentionAssignmentId.generate(),
      userId: UserId.reconstitute(params.userId),
      variant: params.variant,
      startedAt: params.startedAt,
    }),
  );
}

export async function activateRetentionAssignment(
  repository: Pick<RetentionAssignmentRepositoryPort, "findByUserId" | "save">,
  userId: string,
  startedAt: Temporal.Instant,
): Promise<boolean> {
  const assignment = await repository.findByUserId(UserId.reconstitute(userId));
  if (assignment == null || !assignment.activate(startedAt)) {
    return false;
  }
  return repository.save(assignment);
}

export async function retentionAssignmentOf(
  repository: Pick<RetentionAssignmentRepositoryPort, "findByIds">,
  assignmentId: string,
): Promise<RetentionAssignment> {
  const assignments = await repository.findByIds([
    RetentionAssignmentId.reconstitute(assignmentId),
  ]);
  const assignment = assignments.get(assignmentId);
  if (assignment == null) {
    throw new Error(`retention assignment fixture 누락: ${assignmentId}`);
  }
  return assignment;
}
