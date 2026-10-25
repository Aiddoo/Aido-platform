import type {
  PremiumGrant,
  PremiumGrantCreationPlan,
} from "../../../domain/aggregates/subscriptions/premium-grant.aggregate.js";
import {
  type PremiumAccess,
  PremiumAccessPolicy,
  type PremiumEntitlements,
  applyStoreEventChain,
  type StoreEventChainState,
} from "../../../domain/policies/subscriptions/premium-access.policy.js";
import type { PremiumGrantRepositoryPort } from "../../ports/subscriptions/premium-grant.repository.port.js";
import type {
  SubscriptionRepositoryPort,
  UpdateUserSubscriptionStatusData,
} from "../../ports/subscriptions/subscription.repository.port.js";

export interface LoadPremiumEntitlementsOptions {
  /** 웹훅이 방금 판단한 거래 체인 상태 */
  readonly eventChain?: StoreEventChainState;
}

export interface ProjectPremiumAccessInput extends LoadPremiumEntitlementsOptions {
  readonly userId: string;
  readonly now: Date;
  /** 스토어 구독도 보상 기간도 없을 때 남길 상태. 없으면 FREE로 둔다. */
  readonly fallback?: UpdateUserSubscriptionStatusData;
}

export interface PremiumAccessProjection {
  readonly access: PremiumAccess;
  readonly userState: UpdateUserSubscriptionStatusData;
  readonly changedGrantCount: number;
}

interface LoadedPremiumEntitlements {
  readonly entitlements: PremiumEntitlements;
  readonly premiumGrants: readonly PremiumGrant[];
}

interface PremiumAccessProjectorDependencies {
  readonly subscriptionRepository: Pick<
    SubscriptionRepositoryPort,
    "findStoreEntitlements" | "updateUserSubscriptionStatus"
  >;
  readonly premiumGrantRepository: Pick<
    PremiumGrantRepositoryPort,
    "findOpenByUserId" | "saveAll" | "create"
  >;
}

/**
 * 사용자 한 명의 보상 기간을 정리하고 User의 구독 projection을 다시 계산한다.
 * 쓰기 경로는 호출자가 UoW와 사용자 잠금을 소유한다.
 */
export class PremiumAccessProjector {
  readonly #dependencies: PremiumAccessProjectorDependencies;

  constructor(dependencies: PremiumAccessProjectorDependencies) {
    this.#dependencies = dependencies;
  }

  async loadEntitlements(
    userId: string,
    options: LoadPremiumEntitlementsOptions = {},
  ): Promise<LoadedPremiumEntitlements> {
    // 행의 소유자로 신뢰를 정한다. 보상 기간이 바꾸는 User projection에 기대지 않는다
    const [storeSubscriptions, premiumGrants] = await Promise.all([
      this.#dependencies.subscriptionRepository.findStoreEntitlements(userId),
      this.#dependencies.premiumGrantRepository.findOpenByUserId(userId),
    ]);
    return {
      entitlements: {
        storeSubscriptions: applyStoreEventChain(storeSubscriptions, options.eventChain),
        premiumGrants,
      },
      premiumGrants,
    };
  }

  async project(input: ProjectPremiumAccessInput): Promise<PremiumAccessProjection> {
    const loaded = await this.loadEntitlements(input.userId, input);

    const plan = PremiumAccessPolicy.planReconciliation(loaded.entitlements, input.now);
    const grantsById = new Map(loaded.premiumGrants.map((grant) => [grant.id, grant]));
    const changed = new Set<PremiumGrant>();
    const remainders: PremiumGrantCreationPlan[] = [];
    for (const grantId of plan.rebankedGrantIds) {
      const grant = grantsById.get(grantId);
      if (grant?.rebank(input.now)) changed.add(grant);
    }
    for (const grantId of plan.splitGrantIds) {
      const grant = grantsById.get(grantId);
      const remainder = grant?.splitAt(input.now) ?? null;
      if (grant != null && remainder != null) {
        changed.add(grant);
        remainders.push(remainder);
      }
    }
    // 정리가 밀려 시작과 동시에 끝나는 기간이 있으므로 시작을 먼저 적용한다
    for (const activation of plan.activations) {
      const grant = grantsById.get(activation.grantId);
      if (grant?.activate(activation.startsAt)) changed.add(grant);
    }
    for (const grantId of plan.endedGrantIds) {
      const grant = grantsById.get(grantId);
      if (grant?.end(input.now)) changed.add(grant);
    }
    await this.#dependencies.premiumGrantRepository.saveAll([...changed]);
    // 끊은 기간의 출처 키가 하나뿐이라 같은 끊기를 다시 처리해도 남은 기간은 한 번만 생긴다
    for (const remainder of remainders) {
      await this.#dependencies.premiumGrantRepository.create(remainder);
    }

    // 기간을 시작·종료·분할한 뒤의 상태로 다시 판단한다. 새로 쌓은 기간은 저장소에서 다시 읽는다
    const { entitlements } =
      remainders.length === 0 ? loaded : await this.loadEntitlements(input.userId, input);
    const access = PremiumAccessPolicy.resolve(entitlements, input.now);
    const userState: UpdateUserSubscriptionStatusData =
      access.endsAt == null
        ? (input.fallback ?? { subscriptionStatus: "FREE", subscriptionExpiresAt: null })
        : { subscriptionStatus: "ACTIVE", subscriptionExpiresAt: access.endsAt };
    await this.#dependencies.subscriptionRepository.updateUserSubscriptionStatus(
      input.userId,
      userState,
    );

    return { access, userState, changedGrantCount: changed.size + remainders.length };
  }
}
