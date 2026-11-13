import type { NudgeReplyKind, TodoVisibility } from "@aido/api/vocabulary";

import type { CursorPage } from "#api/shared/application/cursor-page";

export interface NudgeUserReadModel {
  readonly id: string;
  readonly userTag: string;
  readonly name: string | null;
  readonly profileImage: string | null;
}

interface NudgeTodoReadModel {
  readonly id: number;
  readonly title: string;
  readonly completed: boolean;
  readonly ownerId: string;
  readonly visibility: TodoVisibility;
}

export interface NudgeReadModel {
  readonly id: number;
  readonly senderId: string;
  readonly receiverId: string;
  readonly todoId: number;
  readonly message: string | null;
  readonly readAt: Temporal.Instant | null;
  readonly createdAt: Temporal.Instant;
  readonly replyKind: NudgeReplyKind | null;
  readonly repliedAt: Temporal.Instant | null;
  readonly replyUpdatedAt: Temporal.Instant | null;
  readonly thankedAt: Temporal.Instant | null;
  readonly sender: NudgeUserReadModel;
  readonly receiver: NudgeUserReadModel;
  readonly todo: NudgeTodoReadModel;
}

export interface SentNudgesReadModel {
  readonly page: CursorPage<NudgeReadModel, number>;
  readonly totalCount: number;
}

export interface ReceivedNudgesReadModel extends SentNudgesReadModel {
  readonly unreadCount: number;
}

export interface NudgeDailyLimitReadModel {
  readonly dailyLimit: number | null;
  readonly used: number;
  readonly remaining: number | null;
}
