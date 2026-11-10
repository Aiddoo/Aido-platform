import { SubscriptionRepositoryPort } from "#api/modules/billing/subscriptions/application/ports/subscription.repository.port";
import type { StoreSubscriptionId } from "#api/modules/billing/subscriptions/domain/store-subscription-id.vo";
import { SubscriptionId } from "#api/modules/billing/subscriptions/domain/subscription-id.vo";
import { Subscription } from "#api/modules/billing/subscriptions/domain/subscription.aggregate";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 저장 사본을 두어 save 없이 바꾼 Aggregate가 저장소 상태로 새지 않게 한다
function copyOf(subscription: Subscription): Subscription {
  return Subscription.reconstitute(subscription.toPrimitives());
}

export class InMemorySubscriptionRepository extends SubscriptionRepositoryPort {
  readonly #subscriptions = new Map<number, Subscription>();
  #sequence: number;

  constructor(subscriptions: readonly Subscription[] = []) {
    super();
    for (const subscription of subscriptions) {
      this.#subscriptions.set(subscription.id.value, copyOf(subscription));
    }
    this.#sequence = Math.max(0, ...this.#subscriptions.keys());
  }

  get all(): readonly Subscription[] {
    return [...this.#subscriptions.values()].map(copyOf);
  }

  async nextId(): Promise<SubscriptionId> {
    this.#sequence += 1;
    return SubscriptionId.reconstitute(this.#sequence);
  }

  async findByStoreSubscriptionId(
    storeSubscriptionId: StoreSubscriptionId,
  ): Promise<Subscription | null> {
    const found = [...this.#subscriptions.values()].find((subscription) =>
      subscription.storeSubscriptionId.equals(storeSubscriptionId),
    );
    return found == null ? null : copyOf(found);
  }

  async listReconcilableByUserId(userId: UserId): Promise<Subscription[]> {
    return [...this.#subscriptions.values()]
      .filter(
        (subscription) =>
          subscription.userId.equals(userId) &&
          (subscription.status === "ACTIVE" || subscription.status === "CANCELLED"),
      )
      .toSorted((left, right) => left.id.value - right.id.value)
      .map(copyOf);
  }

  async existsByUserId(userId: UserId): Promise<boolean> {
    return [...this.#subscriptions.values()].some((subscription) =>
      subscription.userId.equals(userId),
    );
  }

  async claimChain(
    storeSubscriptionId: StoreSubscriptionId,
    userId: UserId,
    now: Temporal.Instant,
  ): Promise<boolean> {
    const found = await this.findByStoreSubscriptionId(storeSubscriptionId);
    if (found == null || found.userId.equals(userId)) {
      return false;
    }
    this.#subscriptions.set(found.id.value, this.#withOwner(found, userId, now));
    return true;
  }

  async takeOverChains(
    fromUserId: UserId,
    toUserId: UserId,
    now: Temporal.Instant,
  ): Promise<number> {
    const owned = [...this.#subscriptions.values()].filter((subscription) =>
      subscription.userId.equals(fromUserId),
    );
    for (const subscription of owned) {
      this.#subscriptions.set(subscription.id.value, this.#withOwner(subscription, toUserId, now));
    }
    return owned.length;
  }

  async save(subscription: Subscription): Promise<void> {
    const existing = this.#subscriptions.get(subscription.id.value);
    // 소유자는 claimChain·takeOverChains가 옮기고, 시작 시각·결제 환경은 처음 저장한 값을 둔다
    this.#subscriptions.set(
      subscription.id.value,
      existing == null
        ? copyOf(subscription)
        : Subscription.reconstitute({
            ...subscription.toPrimitives(),
            userId: existing.userId.value,
            startedAt: existing.toPrimitives().startedAt,
            environment: existing.toPrimitives().environment,
          }),
    );
  }

  #withOwner(subscription: Subscription, userId: UserId, now: Temporal.Instant): Subscription {
    return Subscription.reconstitute({
      ...subscription.toPrimitives(),
      userId: userId.value,
      updatedAt: now,
    });
  }
}
