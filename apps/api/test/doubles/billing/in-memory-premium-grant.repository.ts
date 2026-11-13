import {
  type ListPremiumGrantUsersToReconcileParams,
  PremiumGrantRepositoryPort,
} from "#api/modules/billing/premium-grants/application/ports/premium-grant.repository.port";
import { PremiumGrantId } from "#api/modules/billing/premium-grants/domain/premium-grant-id.vo";
import { PremiumGrant } from "#api/modules/billing/premium-grants/domain/premium-grant.aggregate";
import {
  isStoreEntitlementValid,
  type StoreEntitlement,
} from "#api/modules/billing/shared/domain/premium-access.domain-service";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 저장 사본을 두어 save 없이 바꾼 Aggregate가 저장소 상태로 새지 않게 한다
function copyOf(grant: PremiumGrant): PremiumGrant {
  return PremiumGrant.reconstitute(grant.toPrimitives());
}

function isOpen(grant: PremiumGrant): boolean {
  return grant.status === "BANKED" || grant.status === "ACTIVE";
}

export interface InMemoryPremiumGrantRepositoryOptions {
  /** 사용자의 스토어 구독. 정리 대상 판단(listUserIdsToReconcile)이 읽는다. */
  readonly storeEntitlementsOf?: (userId: string) => readonly StoreEntitlement[];
}

export class InMemoryPremiumGrantRepository extends PremiumGrantRepositoryPort {
  readonly #grants = new Map<string, PremiumGrant>();
  readonly #storeEntitlementsOf: (userId: string) => readonly StoreEntitlement[];
  #sequence = 0;

  constructor(
    grants: readonly PremiumGrant[] = [],
    options: InMemoryPremiumGrantRepositoryOptions = {},
  ) {
    super();
    for (const grant of grants) {
      this.#grants.set(grant.id.value, copyOf(grant));
    }
    this.#storeEntitlementsOf = options.storeEntitlementsOf ?? (() => []);
  }

  get all(): readonly PremiumGrant[] {
    return [...this.#grants.values()].map(copyOf);
  }

  async nextId(): Promise<PremiumGrantId> {
    this.#sequence += 1;
    return PremiumGrantId.reconstitute(`generated-grant-${this.#sequence}`);
  }

  async listOpenByUserId(userId: UserId): Promise<PremiumGrant[]> {
    return [...this.#grants.values()]
      .filter((grant) => grant.userId.equals(userId) && isOpen(grant))
      .toSorted(
        (left, right) =>
          left.toPrimitives().createdAt.epochMilliseconds -
          right.toPrimitives().createdAt.epochMilliseconds,
      )
      .map(copyOf);
  }

  async findBySourceKey(sourceKey: string): Promise<PremiumGrant | null> {
    const found = [...this.#grants.values()].find((grant) => grant.sourceKey === sourceKey);
    return found == null ? null : copyOf(found);
  }

  async findLastEndedAt(userId: UserId): Promise<Temporal.Instant | null> {
    const ended = [...this.#grants.values()]
      .filter((grant) => grant.userId.equals(userId) && grant.status === "ENDED")
      .flatMap((grant) => (grant.endsAt == null ? [] : [grant.endsAt]))
      .toSorted((left, right) => Temporal.Instant.compare(right, left));
    return ended[0] ?? null;
  }

  async saveIfAbsent(grant: PremiumGrant): Promise<boolean> {
    if ([...this.#grants.values()].some((stored) => stored.sourceKey === grant.sourceKey)) {
      return false;
    }
    this.#grants.set(grant.id.value, copyOf(grant));
    return true;
  }

  async saveAll(grants: readonly PremiumGrant[]): Promise<void> {
    for (const grant of grants) {
      const stored = this.#grants.get(grant.id.value);
      if (stored == null) {
        continue;
      }
      // 상태·시작·끝·갱신 시각만 바꾸고 종료 안내 시각은 저장된 값을 둔다
      const changed = grant.toPrimitives();
      this.#grants.set(
        grant.id.value,
        PremiumGrant.reconstitute({
          ...stored.toPrimitives(),
          status: changed.status,
          startsAt: changed.startsAt,
          endsAt: changed.endsAt,
          updatedAt: changed.updatedAt,
        }),
      );
    }
  }

  async listUserIdsToReconcile(params: ListPremiumGrantUsersToReconcileParams): Promise<UserId[]> {
    const { now, afterUserId, limit } = params;
    const endsAfterNow = (grant: PremiumGrant) =>
      grant.endsAt != null && Temporal.Instant.compare(grant.endsAt, now) > 0;
    const grantsOf = (userId: string) =>
      [...this.#grants.values()].filter((grant) => grant.userId.value === userId);
    const hasValidStore = (userId: string) =>
      this.#storeEntitlementsOf(userId).some((store) => isStoreEntitlementValid(store, now));

    const userIds = new Set<string>();
    for (const grant of this.#grants.values()) {
      const userId = grant.userId.value;
      const isEnded = grant.status === "ACTIVE" && grant.endsAt != null && !endsAfterNow(grant);
      const isBankedWithoutHolder =
        grant.status === "BANKED" &&
        !hasValidStore(userId) &&
        !grantsOf(userId).some((other) => other.status === "ACTIVE" && endsAfterNow(other));
      const isRunningUnderStore =
        grant.status === "ACTIVE" && endsAfterNow(grant) && hasValidStore(userId);
      if (isEnded || isBankedWithoutHolder || isRunningUnderStore) {
        userIds.add(userId);
      }
    }
    return [...userIds]
      .toSorted()
      .filter((userId) => afterUserId == null || userId > afterUserId.value)
      .slice(0, limit)
      .map((userId) => UserId.reconstitute(userId));
  }
}
