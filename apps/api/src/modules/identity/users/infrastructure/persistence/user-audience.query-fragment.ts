import { and, eq, gte, isNull, type SQL } from "drizzle-orm";

import { user } from "#api/platform/database/schema/index";

type AudienceUserColumns = Pick<
  typeof user,
  "id" | "role" | "subscriptionStatus" | "subscriptionExpiresAt"
>;

export interface UserAudienceFilter {
  /** true면 ACTIVE만, false면 상태와 상관없이 탈퇴 대기가 아닌 사용자다 */
  readonly activeOnly: boolean;
  readonly lastLoginSince: Temporal.Instant | null;
  /** 부르는 Context가 사용자 칸에 붙이는 자기 조건(구독·푸시 토큰) */
  readonly refine: ((target: AudienceUserColumns) => SQL) | null;
}

export interface UserAudience {
  readonly table: typeof user;
  readonly userId: typeof user.id;
  readonly condition: SQL | undefined;
}

// 다른 Context가 사람을 id 순서로 한 SQL에 고를 때 쓰는 사용자 테이블·칸·조건이다. 탈퇴·상태·로그인 규칙은 identity가 정한다
export function userAudience(filter: UserAudienceFilter): UserAudience {
  return {
    table: user,
    userId: user.id,
    condition: and(
      isNull(user.deletedAt),
      filter.activeOnly ? eq(user.status, "ACTIVE") : undefined,
      filter.lastLoginSince == null ? undefined : gte(user.lastLoginAt, filter.lastLoginSince),
      filter.refine?.(user),
    ),
  };
}
