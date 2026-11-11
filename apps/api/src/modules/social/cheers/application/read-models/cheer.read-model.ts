import type { CursorPage } from "#api/shared/application/cursor-page";

export interface CheerUserSummary {
  readonly id: string;
  readonly userTag: string;
  readonly name: string | null;
  readonly profileImage: string | null;
}

export interface CheerListItem {
  readonly id: number;
  readonly senderId: string;
  readonly receiverId: string;
  readonly message: string | null;
  readonly readAt: Temporal.Instant | null;
  readonly createdAt: Temporal.Instant;
  readonly sender: CheerUserSummary;
  readonly receiver: CheerUserSummary;
}

export interface SentCheers {
  readonly page: CursorPage<CheerListItem, number>;
  readonly totalCount: number;
}

export interface ReceivedCheers extends SentCheers {
  readonly unreadCount: number;
}

export interface CheerDailyLimit {
  readonly dailyLimit: number | null;
  readonly used: number;
  readonly remaining: number | null;
}
