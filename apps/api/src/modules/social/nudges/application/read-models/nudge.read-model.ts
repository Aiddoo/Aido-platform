import type { NudgeReplyKind, TodoVisibility } from "@aido/api/vocabulary";

import type { CursorPage } from "#api/shared/application/cursor-page";

export interface NudgeUserSummary {
  readonly id: string;
  readonly userTag: string;
  readonly name: string | null;
  readonly profileImage: string | null;
}

interface NudgeTodoSummary {
  readonly id: number;
  readonly title: string;
  readonly completed: boolean;
  readonly ownerId: string;
  readonly visibility: TodoVisibility;
}

export interface NudgeListItem {
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
  readonly sender: NudgeUserSummary;
  readonly receiver: NudgeUserSummary;
  readonly todo: NudgeTodoSummary;
}

export interface SentNudges {
  readonly page: CursorPage<NudgeListItem, number>;
  readonly totalCount: number;
}

export interface ReceivedNudges extends SentNudges {
  readonly unreadCount: number;
}

export interface NudgeDailyLimit {
  readonly dailyLimit: number | null;
  readonly used: number;
  readonly remaining: number | null;
}
