import type { CursorPage } from "#api/shared/application/cursor-page";

export interface BlockedUserReadModel {
  // 차단 관계 id. 목록 cursor로 쓴다
  readonly blockId: string;
  readonly userId: string;
  readonly userTag: string;
  readonly name: string | null;
  readonly profileImage: string | null;
  readonly blockedAt: Temporal.Instant;
}

export interface BlockedUserListReadModel {
  readonly page: CursorPage<BlockedUserReadModel, string>;
  readonly totalCount: number;
}
