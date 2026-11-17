import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { LinkedAccountId } from "../../domain/linked-account-id.vo.js";
import type { LinkedAccounts } from "../../domain/linked-accounts.aggregate.js";
import type { AccountProvider } from "../../domain/linked-accounts.constants.js";

export abstract class LinkedAccountsRepositoryPort {
  abstract nextId(): Promise<LinkedAccountId>;
  /** 로그인 수단이 하나도 없으면 null이다 */
  abstract findByUserId(userId: UserId): Promise<LinkedAccounts | null>;
  abstract findUserIdByProviderAccountId(
    provider: AccountProvider,
    providerAccountId: string,
  ): Promise<UserId | null>;
  /**
   * 읽은 뒤 바뀐 계정만 쓴다. 넣을 계정이 유일 제약에 걸리거나(이미 누군가 연결), 뺄 계정이 이미 없거나,
   * 읽은 뒤 비밀번호가 바뀌었으면 false다. 앞서 쓴 변경이 남을 수 있어 false면 호출자가 트랜잭션을 되돌린다
   */
  abstract save(linkedAccounts: LinkedAccounts): Promise<boolean>;
}
