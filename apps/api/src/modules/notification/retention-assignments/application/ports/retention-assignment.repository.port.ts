import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { RetentionAssignmentId } from "../../domain/retention-assignment-id.vo.js";
import type { RetentionAssignment } from "../../domain/retention-assignment.aggregate.js";
import type {
  RetentionStageCandidateReadModel,
  RetentionStageCursorReadModel,
} from "../read-models/retention-stage-candidate.read-model.js";

export abstract class RetentionAssignmentRepositoryPort {
  abstract findByUserId(userId: UserId): Promise<RetentionAssignment | null>;
  // 단계 묶음 하나가 가리키는 배정을 한 쿼리로 읽는다. 없는 배정은 Map에 없다
  abstract findByIds(
    ids: readonly RetentionAssignmentId[],
  ): Promise<ReadonlyMap<string, RetentionAssignment>>;
  // 바뀐 행만 조건부로 쓴다. 이미 배정된 사용자이거나, 다른 실행이 먼저 시작·단계를 닫았으면 그 자리에서 멈추고 false다.
  // 발행과 같은 UnitOfWork 안에서 호출한다
  abstract save(assignment: RetentionAssignment): Promise<boolean>;
  // dueAt까지 결정할 때가 된 SCHEDULED 단계를 생성 순서로 읽는다. 처리 시각 구간이 아니라 상태로 고르므로 늦은 실행도 빠뜨리지 않는다
  abstract findDueStages(params: {
    readonly dueAt: Temporal.Instant;
    readonly after?: RetentionStageCursorReadModel;
    readonly limit: number;
  }): Promise<RetentionStageCandidateReadModel[]>;
}
