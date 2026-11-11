import { BillingUserLockPort } from "#api/modules/billing/premium-grants/application/ports/billing-user-lock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 사용자 행 잠금을 흉내 낸다. 모르는 사용자는 false를 돌려주고 잠근 순서를 남긴다
export class FakeBillingUserLock extends BillingUserLockPort {
  readonly lockedUserIds: string[] = [];
  readonly #knownUserIds: ReadonlySet<string>;

  constructor(knownUserIds: readonly string[]) {
    super();
    this.#knownUserIds = new Set(knownUserIds);
  }

  async lockById(userId: UserId): Promise<boolean> {
    this.lockedUserIds.push(userId.value);
    return this.#knownUserIds.has(userId.value);
  }
}
