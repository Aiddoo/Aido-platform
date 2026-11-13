import type { CursorPage } from "#api/shared/application/cursor-page";

export interface CheerUserReadModel {
  readonly id: string;
  readonly userTag: string;
  readonly name: string | null;
  readonly profileImage: string | null;
}

export interface CheerReadModel {
  readonly id: number;
  readonly senderId: string;
  readonly receiverId: string;
  readonly message: string | null;
  readonly readAt: Temporal.Instant | null;
  readonly createdAt: Temporal.Instant;
  readonly sender: CheerUserReadModel;
  readonly receiver: CheerUserReadModel;
}

export interface SentCheersReadModel {
  readonly page: CursorPage<CheerReadModel, number>;
  readonly totalCount: number;
}

export interface ReceivedCheersReadModel extends SentCheersReadModel {
  readonly unreadCount: number;
}

export interface CheerDailyLimitReadModel {
  readonly dailyLimit: number | null;
  readonly used: number;
  readonly remaining: number | null;
}
