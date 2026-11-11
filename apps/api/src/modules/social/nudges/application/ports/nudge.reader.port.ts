import type { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { NudgeId } from "../../domain/nudge-id.vo.js";
import type { NudgeDirection } from "../../domain/nudges.constants.js";
import type {
  NudgeInteractionTodo,
  NudgeThanksRecipient,
} from "../read-models/nudge-interaction.read-model.js";
import type { NudgeListItem } from "../read-models/nudge.read-model.js";
import type { NudgeThanksCandidateQuery } from "./nudge.repository.port.js";

export interface ListNudgesParams {
  readonly userId: UserId;
  readonly afterNudgeId: NudgeId | null;
  readonly limit: number;
}

// 목록·개수·단건은 서로 차단한 상대와 주고받은 콕을 뺀다
export abstract class NudgeReaderPort {
  // 생성 시각·id 내림차순. after 콕 뒤부터 주고, 그 콕이 없으면 빈 목록이다
  abstract listReceived(params: ListNudgesParams): Promise<NudgeListItem[]>;
  abstract listSent(params: ListNudgesParams): Promise<NudgeListItem[]>;
  abstract countReceived(userId: UserId): Promise<number>;
  abstract countSent(userId: UserId): Promise<number>;
  abstract countUnreadReceived(userId: UserId): Promise<number>;

  // 보는 사람이 보내거나 받은 콕만 준다
  abstract findInteraction(nudgeId: NudgeId, viewerId: UserId): Promise<NudgeListItem | null>;
  // id 내림차순. after 콕보다 id가 작은 것부터 준다
  abstract listInteractions(params: {
    readonly viewerId: UserId;
    readonly direction: NudgeDirection;
    readonly afterNudgeId: NudgeId | null;
    readonly limit: number;
  }): Promise<NudgeListItem[]>;

  abstract findInteractionTodo(
    todoId: TodoId,
    ownerId: UserId,
  ): Promise<NudgeInteractionTodo | null>;
  abstract findLastReceivedNudgeId(todoId: TodoId, receiverId: UserId): Promise<NudgeId | null>;
  // 그 할 일에서 이미 감사를 전한 서로 다른 친구 수와 마지막 감사 시각
  abstract countThankedRecipients(todoId: TodoId, receiverId: UserId): Promise<number>;
  abstract findLastThankedAt(todoId: TodoId, receiverId: UserId): Promise<Temporal.Instant | null>;
  // 감사 대상(NudgeThanksCandidateQuery)을 id 내림차순으로. limit이 null이면 모두 준다
  abstract listThanksRecipients(
    query: NudgeThanksCandidateQuery & {
      readonly afterNudgeId: NudgeId | null;
      readonly limit: number | null;
    },
  ): Promise<NudgeThanksRecipient[]>;
  abstract countThanksRecipients(query: NudgeThanksCandidateQuery): Promise<number>;
}
