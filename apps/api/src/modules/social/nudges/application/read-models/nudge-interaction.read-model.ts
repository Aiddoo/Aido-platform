import type { TodoVisibility } from "@aido/api/vocabulary";

import type { NudgeListItem, NudgeUserSummary } from "./nudge.read-model.js";

export interface NudgeInteraction extends NudgeListItem {
  // 지금 답장·감사를 할 수 있는지(친구 관계와 받은 사람의 공개 할 일이 유지되는지)
  readonly isAvailable: boolean;
}

export interface NudgeInteractionTodo {
  readonly id: number;
  readonly ownerId: string;
  readonly title: string;
  readonly completed: boolean;
  readonly visibility: TodoVisibility;
}

export interface NudgeThanksRecipient {
  readonly nudgeId: number;
  readonly sender: NudgeUserSummary;
}

export interface NudgeThanksPreview {
  readonly todoId: number;
  readonly throughNudgeId: number | null;
  readonly recipients: readonly NudgeUserSummary[];
  // limit 없이 부르는 옛 앱 요청에는 페이지 정보를 싣지 않는다
  readonly pagination: {
    readonly totalRecipients: number;
    readonly nextCursor: number | null;
    readonly hasNext: boolean;
  } | null;
  readonly thankedRecipientCount: number;
  readonly lastThankedAt: Temporal.Instant | null;
}
