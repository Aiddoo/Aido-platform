import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  applyStoreEventChain,
  type PremiumEntitlements,
  type StoreEventChainState,
} from "../../../shared/domain/premium-access.domain-service.js";
import type { PremiumGrant } from "../../domain/premium-grant.aggregate.js";
import type { PremiumGrantRepositoryPort } from "../ports/premium-grant.repository.port.js";
import type { StoreEntitlementReaderPort } from "../ports/store-entitlement.reader.port.js";

export interface GetPremiumEntitlementsQuery {
  readonly userId: UserId;
  /** 웹훅이 방금 판단한 거래 체인 상태 */
  readonly eventChain?: StoreEventChainState;
}

export interface UserPremiumEntitlements {
  readonly entitlements: PremiumEntitlements;
  readonly premiumGrants: readonly PremiumGrant[];
}

export interface GetPremiumEntitlementsDependencies {
  readonly storeEntitlementReader: Pick<StoreEntitlementReaderPort, "listByUserId">;
  readonly premiumGrantRepository: Pick<PremiumGrantRepositoryPort, "listOpenByUserId">;
}

export class GetPremiumEntitlementsUseCase {
  readonly #dependencies: GetPremiumEntitlementsDependencies;

  constructor(dependencies: GetPremiumEntitlementsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetPremiumEntitlementsQuery): Promise<UserPremiumEntitlements> {
    const { storeEntitlementReader, premiumGrantRepository } = this.#dependencies;
    // 행의 소유자로 신뢰를 정한다. 보상 기간이 바꾸는 User projection에 기대지 않는다
    const [storeSubscriptions, premiumGrants] = await Promise.all([
      storeEntitlementReader.listByUserId(query.userId),
      premiumGrantRepository.listOpenByUserId(query.userId),
    ]);
    return {
      entitlements: {
        storeSubscriptions: applyStoreEventChain(storeSubscriptions, query.eventChain),
        premiumGrants: premiumGrants.map((grant) => grant.toTerm()),
      },
      premiumGrants,
    };
  }
}
