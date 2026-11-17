import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { AccountProvider } from "../../../linked-accounts/domain/linked-accounts.constants.js";

// 다른 Context가 사람을 보여 줄 때 쓰는 프로필 요약이다. 이름이 없으면 null이다
export interface UserBriefReadModel {
  readonly userId: UserId;
  readonly userTag: string;
  readonly name: string | null;
  readonly profileImage: string | null;
  readonly isDeletionPending: boolean;
}

// rank는 0 태그 정확 일치, 1 태그 앞부분, 2 이름 앞부분, 3 부분 일치다
export interface UserSearchMatchReadModel {
  readonly user: UserBriefReadModel;
  readonly rank: number;
}

// 가입 시각과 로그인 수단이다. 인증하지 않은 이메일은 null이다
export interface UserAccountIdentityReadModel {
  readonly user: UserBriefReadModel;
  readonly joinedAt: Temporal.Instant;
  readonly verifiedEmail: string | null;
  readonly providerAccounts: readonly {
    readonly provider: AccountProvider;
    readonly providerAccountId: string;
  }[];
}
