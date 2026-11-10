import type { EntitlementSnapshot } from "@aido/api/contracts/entitlement";

import type { QuotaLedgerPort } from "#api/modules/access/access-quota.public";
import type { TodoCategoryCountReaderPort } from "#api/modules/planning/categories/planning-categories.public";
import type { DailySendUsageReaderPort } from "#api/modules/social/social-cheers.public";
import type { FriendCountReaderPort } from "#api/modules/social/social-friends.public";

export interface GetEntitlementSnapshotQuery {
  readonly userId: string;
  /** 응원·찌르기 일간 사용량의 하루 기준(X-Timezone) */
  readonly timezone: string;
}

interface GetEntitlementSnapshotDependencies {
  readonly quotaLedger: Pick<QuotaLedgerPort, "readSnapshot">;
  readonly cheerUsageReader: Pick<DailySendUsageReaderPort, "readDailyUsage">;
  readonly nudgeUsageReader: Pick<DailySendUsageReaderPort, "readDailyUsage">;
  readonly friendCountReader: Pick<FriendCountReaderPort, "countCurrentFriends">;
  readonly categoryCountReader: Pick<TodoCategoryCountReaderPort, "countCategories">;
}

/**
 * GET /v1/entitlements. 한도·계량기 사용량은 Access 원장이 계산하고, Access가 의존할 수 없는 응원·찌르기
 * 일간 사용량과 친구·카테고리 개수는 /me처럼 여기서 Social·Planning 읽기 포트로 모아 넘긴다. 개수는 친구
 * 맺기·카테고리 만들기 한도 검사와 같은 값이라 앱이 한도에 닿은 것을 입력 전에 안다.
 */
export class GetEntitlementSnapshotUseCase {
  readonly #dependencies: GetEntitlementSnapshotDependencies;

  constructor(dependencies: GetEntitlementSnapshotDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetEntitlementSnapshotQuery): Promise<EntitlementSnapshot> {
    const { userId, timezone } = input;
    const {
      quotaLedger,
      cheerUsageReader,
      nudgeUsageReader,
      friendCountReader,
      categoryCountReader,
    } = this.#dependencies;
    const [cheer, nudge, friendCount, categoryCount] = await Promise.all([
      cheerUsageReader.readDailyUsage(userId, timezone),
      nudgeUsageReader.readDailyUsage(userId, timezone),
      friendCountReader.countCurrentFriends(userId),
      categoryCountReader.countCategories(userId),
    ]);
    return quotaLedger.readSnapshot(userId, {
      daily: { CHEER: cheer, NUDGE: nudge },
      resourceCounts: { FRIEND: friendCount, TODO_CATEGORY: categoryCount },
    });
  }
}
