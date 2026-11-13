import { SUBSCRIPTION_STATUS, USER_ROLE, type SubscriptionStatus } from "@aido/api/vocabulary";

import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { NO_FEATURE_GRANTS, type FeatureGrants } from "../../../shared/domain/access.constants.js";
import {
  resolveAccessSubject,
  type AccessState,
} from "../../../shared/domain/entitlement.domain-service.js";
import type { AccessStateReaderPort } from "../ports/access-state.reader.port.js";
import type { CachedAccessState, EntitlementCachePort } from "../ports/entitlement-cache.port.js";
import type {
  AccessReadConsistency,
  ResolvedAccess,
} from "../read-models/resolved-access.read-model.js";

export interface GetResolvedAccessQuery {
  readonly userId: string;
  readonly consistency: AccessReadConsistency;
}

export interface GetResolvedAccessDependencies {
  readonly accessStateReader: Pick<
    AccessStateReaderPort,
    "findActiveUserAccessState" | "findFeatureGrants"
  >;
  readonly entitlementCache: Pick<EntitlementCachePort, "wrap">;
  readonly clock: ClockPort;
}

interface StoredAccess {
  readonly state: AccessState;
  readonly grants: FeatureGrants;
}

// 없는 사용자·비활성 계정은 무료 기본 한도로 판단한다
const FREE_USER_STATE: AccessState = {
  role: USER_ROLE.USER,
  subscriptionStatus: "FREE",
  accessDeadline: null,
};

// 캐시 값은 검증한 문자열이라 모르는 상태는 무료로 본다(ACTIVE만 유료다)
function toSubscriptionStatus(raw: string | null): SubscriptionStatus {
  return SUBSCRIPTION_STATUS.find((status) => status === raw) ?? "FREE";
}

function toCachedAccessState(state: AccessState | null, grants: FeatureGrants): CachedAccessState {
  return {
    status: state?.subscriptionStatus ?? null,
    isAdmin: state?.role === USER_ROLE.ADMIN,
    accessDeadlineMs: state?.accessDeadline?.epochMilliseconds ?? null,
    resourceBonuses: grants,
  };
}

function fromCachedAccessState(cached: CachedAccessState | null): StoredAccess {
  const deadlineMs = cached?.accessDeadlineMs;
  return {
    state: {
      role: cached?.isAdmin === true ? USER_ROLE.ADMIN : USER_ROLE.USER,
      subscriptionStatus: toSubscriptionStatus(cached?.status ?? null),
      accessDeadline:
        deadlineMs == null ? null : Temporal.Instant.fromEpochMilliseconds(deadlineMs),
    },
    grants: cached?.resourceBonuses ?? NO_FEATURE_GRANTS,
  };
}

/** 판단 시각의 권한 주체. 캐시도 끝나는 시각을 함께 담아 TTL 안에서도 그 시각을 넘기지 않는다. */
export class GetResolvedAccessUseCase {
  readonly #dependencies: GetResolvedAccessDependencies;

  constructor(dependencies: GetResolvedAccessDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetResolvedAccessQuery): Promise<ResolvedAccess> {
    const userId = UserId.reconstitute(query.userId);
    const { state, grants } =
      query.consistency === "latest"
        ? await this.#readLatest(userId)
        : await this.#readCached(userId);
    return { ...resolveAccessSubject({ state, now: this.#dependencies.clock.now() }), grants };
  }

  async #readLatest(userId: UserId): Promise<StoredAccess> {
    const [state, grants] = await this.#readStored(userId);
    return { state: state ?? FREE_USER_STATE, grants };
  }

  async #readCached(userId: UserId): Promise<StoredAccess> {
    const cached = await this.#dependencies.entitlementCache.wrap(userId, async () =>
      toCachedAccessState(...(await this.#readStored(userId))),
    );
    return fromCachedAccessState(cached);
  }

  #readStored(userId: UserId): Promise<[AccessState | null, FeatureGrants]> {
    const { accessStateReader } = this.#dependencies;
    return Promise.all([
      accessStateReader.findActiveUserAccessState(userId),
      accessStateReader.findFeatureGrants(userId),
    ]);
  }
}
