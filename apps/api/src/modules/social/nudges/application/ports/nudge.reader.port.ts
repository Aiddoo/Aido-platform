import type { NudgeDirection } from "@aido/api/vocabulary";

import type { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";
import type { CursorPage } from "#api/shared/application/cursor-page";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { NudgeId } from "../../domain/nudge-id.vo.js";
import type {
  NudgeInteractionTodoReadModel,
  NudgeThanksRecipientReadModel,
} from "../read-models/nudge-interaction.read-model.js";
import type { NudgeReadModel } from "../read-models/nudge.read-model.js";
import type { NudgeThanksCandidateQuery } from "./nudge.repository.port.js";

export interface ListNudgesParams {
  readonly userId: UserId;
  readonly afterNudgeId: NudgeId | null;
  readonly size: number;
}

// 목록·개수·단건은 서로 차단한 상대와 주고받은 콕을 뺀다
export abstract class NudgeReaderPort {
  // 생성 시각·id 내림차순. after 콕 뒤부터 주고, 그 콕이 없으면 빈 쪽이다. 커서는 콕 id다
  abstract listReceived(params: ListNudgesParams): Promise<CursorPage<NudgeReadModel, number>>;
  abstract listSent(params: ListNudgesParams): Promise<CursorPage<NudgeReadModel, number>>;
  abstract countReceived(userId: UserId): Promise<number>;
  abstract countSent(userId: UserId): Promise<number>;
  abstract countUnreadReceived(userId: UserId): Promise<number>;

  // 보는 사람이 보내거나 받은 콕만 준다
  abstract findInteraction(nudgeId: NudgeId, viewerId: UserId): Promise<NudgeReadModel | null>;
  // id 내림차순. after 콕보다 id가 작은 것부터 준다. 커서는 콕 id다
  abstract listInteractions(params: {
    readonly viewerId: UserId;
    readonly direction: NudgeDirection;
    readonly afterNudgeId: NudgeId | null;
    readonly size: number;
  }): Promise<CursorPage<NudgeReadModel, number>>;

  abstract findInteractionTodo(
    todoId: TodoId,
    ownerId: UserId,
  ): Promise<NudgeInteractionTodoReadModel | null>;
  abstract findLastReceivedNudgeId(todoId: TodoId, receiverId: UserId): Promise<NudgeId | null>;
  // 그 할 일에서 이미 감사를 전한 서로 다른 친구 수와 마지막 감사 시각
  abstract countThankedRecipients(todoId: TodoId, receiverId: UserId): Promise<number>;
  abstract findLastThankedAt(todoId: TodoId, receiverId: UserId): Promise<Temporal.Instant | null>;
  // 감사 대상(NudgeThanksCandidateQuery)을 id 내림차순으로 모두 준다
  abstract listAllThanksRecipients(
    query: NudgeThanksCandidateQuery,
  ): Promise<NudgeThanksRecipientReadModel[]>;
  // 같은 순서로 after 콕보다 id가 작은 것부터 한 쪽을 준다. 커서는 콕 id다
  abstract listThanksRecipients(
    query: NudgeThanksCandidateQuery & {
      readonly afterNudgeId: NudgeId | null;
      readonly size: number;
    },
  ): Promise<CursorPage<NudgeThanksRecipientReadModel, number>>;
  abstract countThanksRecipients(query: NudgeThanksCandidateQuery): Promise<number>;
}
