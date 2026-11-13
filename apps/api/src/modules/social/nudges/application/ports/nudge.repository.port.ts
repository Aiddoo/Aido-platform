import type { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { DailySendWindow } from "../../../shared/domain/daily-send-window.domain-service.js";
import type { NudgeId } from "../../domain/nudge-id.vo.js";
import type { NudgeTargetTodo } from "../../domain/nudge-target-todo.vo.js";
import type { Nudge } from "../../domain/nudge.aggregate.js";
import type { NudgeInteractionTodoReadModel } from "../read-models/nudge-interaction.read-model.js";

// 감사 대상: 받은 사람이 소유한 공개 할 일에서 throughNudgeId까지 받은 콕 중
// 지금 친구이고 아직 감사받지 않은 보낸 사람마다 가장 최근 콕 하나
export interface NudgeThanksCandidateQuery {
  readonly ownerId: UserId;
  readonly todoId: TodoId;
  readonly throughNudgeId: NudgeId;
  readonly friendIds: readonly UserId[];
}

export abstract class NudgeRepositoryPort {
  abstract nextId(): Promise<NudgeId>;
  abstract findById(nudgeId: NudgeId): Promise<Nudge | null>;
  // 생성 시각이 가장 늦은 콕
  abstract findLastSentForTodo(senderId: UserId, todoId: TodoId): Promise<Nudge | null>;
  abstract findLastSentTo(senderId: UserId, receiverId: UserId): Promise<Nudge | null>;
  // startsAt 이상 endsAt 미만에 보낸 콕 수(리마인드 콕은 세지 않는다)
  abstract countSentBetween(
    senderId: UserId,
    window: Pick<DailySendWindow, "startsAt" | "endsAt">,
  ): Promise<number>;
  // id 내림차순
  abstract listThanksCandidates(query: NudgeThanksCandidateQuery): Promise<Nudge[]>;
  // 읽음·감사 시각은 먼저 저장된 값을 덮어쓰지 않는다
  abstract save(nudge: Nudge): Promise<void>;
  // 감사처럼 여러 콕을 한 문장으로 저장한다. 칸마다 규칙은 save와 같다
  abstract saveAll(nudges: readonly Nudge[]): Promise<void>;

  // 대상 할 일은 planning이 소유한 행을 읽기만 한다
  abstract findTargetTodo(todoId: TodoId): Promise<NudgeTargetTodo | null>;
  // 완료·공개 변경과 읽음·답장·감사 저장을 같은 행 잠금으로 직렬화한다
  abstract lockInteractionTodo(
    todoId: TodoId,
    ownerId: UserId,
  ): Promise<NudgeInteractionTodoReadModel | null>;
}
