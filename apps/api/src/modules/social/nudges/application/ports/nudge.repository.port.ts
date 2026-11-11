import type { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { DailySendWindow } from "../../../shared/domain/daily-send-window.domain-service.js";
import type { NudgeId } from "../../domain/nudge-id.vo.js";
import type { NudgeTargetTodo } from "../../domain/nudge-target-todo.vo.js";
import type { Nudge } from "../../domain/nudge.aggregate.js";
import type { ReminderNudgeId } from "../../domain/reminder-nudge-id.vo.js";
import type { ReminderNudge } from "../../domain/reminder-nudge.aggregate.js";
import type { NudgeInteractionTodo } from "../read-models/nudge-interaction.read-model.js";

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
  // 읽음·감사 시각은 먼저 저장된 값을 덮어쓰지 않는다
  abstract save(nudge: Nudge): Promise<void>;
  abstract saveThanks(nudges: readonly Nudge[]): Promise<void>;
  // id 내림차순
  abstract listThanksCandidates(query: NudgeThanksCandidateQuery): Promise<Nudge[]>;

  // 대상 할 일은 planning이 소유한 행을 읽기만 한다
  abstract findTargetTodo(todoId: TodoId): Promise<NudgeTargetTodo | null>;
  // 완료·공개 변경과 답장·감사 저장을 같은 행 잠금으로 직렬화한다
  abstract lockInteractionTodo(
    todoId: TodoId,
    ownerId: UserId,
  ): Promise<NudgeInteractionTodo | null>;
  // 그 날짜에 걸친 할 일 수(기간 할 일은 시작~종료, 하루 할 일은 시작일)
  abstract countTodosOn(ownerId: UserId, date: Temporal.PlainDate): Promise<number>;

  abstract nextReminderId(): Promise<ReminderNudgeId>;
  abstract findLastReminderSentTo(
    senderId: UserId,
    receiverId: UserId,
  ): Promise<ReminderNudge | null>;
  abstract saveReminder(reminder: ReminderNudge): Promise<void>;
}
