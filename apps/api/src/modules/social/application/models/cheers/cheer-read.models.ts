import type { CheerWithRelations } from "../../ports/cheers/cheer.repository.port.js";

export interface GetCheersInput {
  readonly userId: string;
  readonly cursor?: number;
  readonly size?: number;
}

export interface SentCheersSnapshot {
  readonly items: CheerWithRelations[];
  readonly totalCount: number;
  readonly hasMore: boolean;
}

export interface ReceivedCheersSnapshot extends SentCheersSnapshot {
  readonly unreadCount: number;
}

export interface CheerLimitSnapshot {
  readonly dailyLimit: number | null;
  readonly used: number;
  readonly remaining: number | null;
}
