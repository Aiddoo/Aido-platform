import type { TodoVisibility } from "@aido/api/vocabulary";

import type { NudgeReadModel, NudgeUserReadModel } from "./nudge.read-model.js";

// 서버 설정으로 답장·감사 기능을 켰는지
export interface NudgeInteractionAvailabilityReadModel {
  readonly enabled: boolean;
}

export interface NudgeInteractionReadModel extends NudgeReadModel {
  // 지금 답장·감사를 할 수 있는지(친구 관계와 받은 사람의 공개 할 일이 유지되는지)
  readonly isAvailable: boolean;
}

export interface NudgeInteractionTodoReadModel {
  readonly id: number;
  readonly ownerId: string;
  readonly title: string;
  readonly completed: boolean;
  readonly visibility: TodoVisibility;
}

export interface NudgeThanksRecipientReadModel {
  readonly nudgeId: number;
  readonly sender: NudgeUserReadModel;
}

export interface NudgeThanksPreviewReadModel {
  readonly todoId: number;
  readonly throughNudgeId: number | null;
  readonly recipients: readonly NudgeUserReadModel[];
  // limit 없이 부르는 옛 앱 요청에는 페이지 정보를 싣지 않는다
  readonly pagination: {
    readonly totalRecipients: number;
    readonly nextCursor: number | null;
    readonly hasNext: boolean;
  } | null;
  readonly thankedRecipientCount: number;
  readonly lastThankedAt: Temporal.Instant | null;
}
