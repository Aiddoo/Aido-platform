import type { BroadcastTargetFilter } from "@aido/api/vocabulary";

import { AdminUserDirectoryReaderPort } from "#api/modules/operations/broadcasts/application/ports/admin-user-directory.reader.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 대상 필터와 상관없이 가진 사용자를 ID 오름차순으로 돌려준다(필터 SQL은 Drizzle 통합 테스트가 본다)
export class InMemoryAdminUserDirectoryReader extends AdminUserDirectoryReaderPort {
  readonly #userIds: readonly string[];

  constructor(userIds: readonly string[]) {
    super();
    this.#userIds = userIds.toSorted();
  }

  async listTargetUserIdsAfter(params: {
    readonly filter: BroadcastTargetFilter;
    readonly cursorUserId: UserId | null;
    readonly limit: number;
  }): Promise<UserId[]> {
    const { cursorUserId, limit } = params;
    return this.#userIds
      .filter((userId) => cursorUserId == null || userId > cursorUserId.value)
      .slice(0, limit)
      .map((userId) => UserId.reconstitute(userId));
  }

  async countTargets(): Promise<number> {
    return this.#userIds.length;
  }

  async listExistingUserIds(userIds: readonly UserId[]): Promise<UserId[]> {
    return userIds.filter((userId) => this.#userIds.includes(userId.value));
  }
}
