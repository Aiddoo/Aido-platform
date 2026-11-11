import type { BroadcastTargetFilter } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

/** 필터를 쿼리로 바꾸는 일은 Infrastructure가 맡고 Application은 대상 필터의 의미만 다룬다. */
export abstract class AdminUserDirectoryReaderPort {
  /** cursor 다음의 대상 사용자 ID를 ID 오름차순으로 limit만큼 읽는다. */
  abstract listTargetUserIdsAfter(params: {
    readonly filter: BroadcastTargetFilter;
    readonly cursorUserId: UserId | null;
    readonly limit: number;
  }): Promise<UserId[]>;
  abstract countTargets(filter: BroadcastTargetFilter): Promise<number>;
  /** 주어진 ID 중 실제 존재(비삭제)하는 사용자 ID만 돌려준다. */
  abstract listExistingUserIds(userIds: readonly UserId[]): Promise<UserId[]>;
}
