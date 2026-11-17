import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { AccountProvider } from "../../../linked-accounts/domain/linked-accounts.constants.js";

// 가입 방식은 처음 만든 로그인 수단이다(나중에 연결한 수단이 아님). 이름이 없거나 비었으면 null이다
export interface UserSignupReadModel {
  readonly userId: UserId;
  readonly email: string;
  readonly userTag: string;
  readonly name: string | null;
  readonly signedUpAt: Temporal.Instant;
  readonly signupMethod: AccountProvider | null;
}

export interface SignupCountReadModel {
  readonly signupMethod: AccountProvider;
  readonly count: number;
}
