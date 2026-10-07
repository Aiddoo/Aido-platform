import type { NudgeWithRelations } from "../../ports/nudges/nudge.repository.port.js";

export interface GetNudgesInput {
  readonly userId: string;
  readonly cursor?: number;
  readonly size?: number;
}

export interface SentNudgesSnapshot {
  readonly items: NudgeWithRelations[];
  readonly totalCount: number;
  readonly hasMore: boolean;
}

export interface ReceivedNudgesSnapshot extends SentNudgesSnapshot {
  readonly unreadCount: number;
}

export interface NudgeLimitSnapshot {
  readonly dailyLimit: number | null;
  readonly used: number;
  readonly remaining: number | null;
}
