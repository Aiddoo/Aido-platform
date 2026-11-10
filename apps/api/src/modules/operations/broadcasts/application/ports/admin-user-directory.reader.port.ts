import type { BroadcastTargetFilter } from "@aido/api/vocabulary";

export const ADMIN_USER_DIRECTORY = Symbol("ADMIN_USER_DIRECTORY");

/** 필터를 쿼리로 바꾸는 일은 Infrastructure가 맡고 Application은 대상 필터의 의미만 다룬다. */
export interface AdminUserDirectoryPort {
  /** cursor 다음의 대상 사용자 ID를 ID 오름차순으로 limit만큼 읽는다. */
  findTargetUserIdsAfter(
    filter: BroadcastTargetFilter,
    cursorUserId: string | null,
    limit: number,
  ): Promise<string[]>;
  countTargets(filter: BroadcastTargetFilter): Promise<number>;
  /** 주어진 ID 중 실제 존재(비삭제)하는 사용자 ID만 반환한다 */
  findExistingUserIds(userIds: string[]): Promise<string[]>;
}
