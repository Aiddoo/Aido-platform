import type { PremiumGrant } from "../../../domain/aggregates/subscriptions/premium-grant.aggregate.js";
import {
  type PremiumAccess,
  PremiumAccessPolicy,
  type PremiumEntitlements,
  selectTrustedStoreSubscriptions,
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
    "findUserById" | "findStoreEntitlements" | "updateUserSubscriptionStatus"
  >;
  readonly premiumGrantRepository: Pick<PremiumGrantRepositoryPort, "findOpenByUserId" | "saveAll">;
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
    const [user, storeSubscriptions, premiumGrants] = await Promise.all([
      this.#dependencies.subscriptionRepository.findUserById(userId),
      this.#dependencies.subscriptionRepository.findStoreEntitlements(userId),
      this.#dependencies.premiumGrantRepository.findOpenByUserId(userId),
    ]);
    return {
      entitlements: {
        storeSubscriptions: selectTrustedStoreSubscriptions(storeSubscriptions, {
          userStatus: user?.subscriptionStatus ?? null,
          eventChain: options.eventChain,
        }),
        premiumGrants,
      },
      premiumGrants,
    };
  }

  async project(input: ProjectPremiumAccessInput): Promise<PremiumAccessProjection> {
    const { entitlements, premiumGrants } = await this.loadEntitlements(input.userId, input);

    const plan = PremiumAccessPolicy.planReconciliation(entitlements, input.now);
    const grantsById = new Map(premiumGrants.map((grant) => [grant.id, grant]));
    const changed = new Set<PremiumGrant>();
    for (const grantId of plan.endedGrantIds) {
      const grant = grantsById.get(grantId);
      if (grant?.end(input.now)) changed.add(grant);
    }
    for (const activation of plan.activations) {
      const grant = grantsById.get(activation.grantId);
      if (grant?.activate(activation.startsAt)) changed.add(grant);
    }
    await this.#dependencies.premiumGrantRepository.saveAll([...changed]);

    // 기간을 시작·종료한 뒤의 상태로 다시 판단한다
    const access = PremiumAccessPolicy.resolve(entitlements, input.now);
    const userState: UpdateUserSubscriptionStatusData =
      access.endsAt === null
        ? (input.fallback ?? { subscriptionStatus: "FREE", subscriptionExpiresAt: null })
        : { subscriptionStatus: "ACTIVE", subscriptionExpiresAt: access.endsAt };
    await this.#dependencies.subscriptionRepository.updateUserSubscriptionStatus(
      input.userId,
      userState,
    );

    return { access, userState, changedGrantCount: changed.size };
  }
}
