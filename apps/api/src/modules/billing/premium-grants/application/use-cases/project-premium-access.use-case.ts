import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  planPremiumReconciliation,
  resolvePremiumAccess,
  type PremiumAccess,
  type StoreEventChainState,
} from "../../../shared/premium-access.domain-service.js";
import type { PremiumGrant } from "../../domain/premium-grant.aggregate.js";
import type { PremiumGrantRepositoryPort } from "../ports/premium-grant.repository.port.js";
import type {
  UserSubscriptionProjection,
  UserSubscriptionProjectionRepositoryPort,
} from "../ports/user-subscription-projection.repository.port.js";
import type { LoadPremiumEntitlementsUseCase } from "./load-premium-entitlements.use-case.js";

export interface ProjectPremiumAccessCommand {
  readonly userId: UserId;
  readonly now: Temporal.Instant;
  /** 웹훅이 방금 판단한 거래 체인 상태 */
  readonly eventChain?: StoreEventChainState;
  /** 스토어 구독도 보상 기간도 없을 때 남길 상태. 없으면 FREE로 둔다. */
  readonly fallback?: UserSubscriptionProjection;
}

export interface PremiumAccessProjection {
  readonly access: PremiumAccess;
  readonly projection: UserSubscriptionProjection;
  readonly changedGrantCount: number;
}

export interface ProjectPremiumAccessDependencies {
  readonly loadPremiumEntitlements: Pick<LoadPremiumEntitlementsUseCase, "execute">;
  readonly premiumGrantRepository: Pick<
    PremiumGrantRepositoryPort,
    "nextId" | "saveAll" | "saveIfAbsent"
  >;
  readonly userSubscriptionProjection: Pick<UserSubscriptionProjectionRepositoryPort, "update">;
}

/**
 * 사용자 한 명의 보상 기간을 정리하고 User의 구독 projection을 다시 계산한다.
 * 쓰기 경로는 호출자가 UoW와 사용자 잠금을 소유한다.
 */
export class ProjectPremiumAccessUseCase {
  readonly #dependencies: ProjectPremiumAccessDependencies;

  constructor(dependencies: ProjectPremiumAccessDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: ProjectPremiumAccessCommand): Promise<PremiumAccessProjection> {
    const { loadPremiumEntitlements, premiumGrantRepository, userSubscriptionProjection } =
      this.#dependencies;
    const { userId, now, eventChain } = command;
    const loaded = await loadPremiumEntitlements.execute({
      userId,
      ...(eventChain != null && { eventChain }),
    });

    const plan = planPremiumReconciliation(loaded.entitlements, now);
    const grantsById = new Map(loaded.premiumGrants.map((grant) => [grant.id.value, grant]));
    const changed = new Set<PremiumGrant>();
    const remainders: PremiumGrant[] = [];
    for (const grantId of plan.rebankedGrantIds) {
      const grant = grantsById.get(grantId);
      if (grant?.returnToBank(now)) {
        changed.add(grant);
      }
    }
    for (const grantId of plan.splitGrantIds) {
      const grant = grantsById.get(grantId);
      const remainder = grant?.splitAt(now, await premiumGrantRepository.nextId()) ?? null;
      if (grant != null && remainder != null) {
        changed.add(grant);
        remainders.push(remainder);
      }
    }
    // 정리가 밀려 시작과 동시에 끝나는 기간이 있으므로 시작을 먼저 적용한다
    for (const activation of plan.activations) {
      const grant = grantsById.get(activation.grantId);
      if (grant?.activate(activation.startsAt, now)) {
        changed.add(grant);
      }
    }
    for (const grantId of plan.endedGrantIds) {
      const grant = grantsById.get(grantId);
      if (grant?.end(now)) {
        changed.add(grant);
      }
    }
    await premiumGrantRepository.saveAll([...changed]);
    // 끊은 기간의 출처 키가 하나뿐이라 같은 끊기를 다시 처리해도 남은 기간은 한 번만 생긴다
    for (const remainder of remainders) {
      await premiumGrantRepository.saveIfAbsent(remainder);
    }

    // 기간을 시작·종료·분할한 뒤의 상태로 다시 판단한다. 새로 쌓은 기간은 저장소에서 다시 읽는다
    const entitlements =
      remainders.length === 0
        ? {
            ...loaded.entitlements,
            premiumGrants: loaded.premiumGrants.map((grant) => grant.toTerm()),
          }
        : (
            await loadPremiumEntitlements.execute({
              userId,
              ...(eventChain != null && { eventChain }),
            })
          ).entitlements;
    const access = resolvePremiumAccess(entitlements, now);
    const projection: UserSubscriptionProjection =
      access.endsAt == null
        ? (command.fallback ?? { subscriptionStatus: "FREE", subscriptionExpiresAt: null })
        : { subscriptionStatus: "ACTIVE", subscriptionExpiresAt: access.endsAt };
    await userSubscriptionProjection.update(userId, projection);

    return { access, projection, changedGrantCount: changed.size + remainders.length };
  }
}
