import type { SubscriptionStatus, UserRole } from "@aido/api/vocabulary";

import { AccessStateReaderPort } from "#api/modules/access/entitlements/application/ports/access-state.reader.port";
import type { AccessState } from "#api/modules/access/entitlements/domain/entitlement.domain-service";
import type { FeatureGrants } from "#api/modules/access/entitlements/domain/entitlements.constants";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { InMemoryFeatureGrantRepository } from "./in-memory-feature-grant.repository.js";

/** 권한 판단과 AI_PLAN 카운터가 읽는 사용자 행(User). 원장·잠금 대역이 같은 Map을 함께 본다. */
export interface InMemoryAccessUser {
  role: UserRole;
  subscriptionStatus: SubscriptionStatus;
  /** 스토어 유예까지 반영한 프리미엄이 끝나는 시각. null이면 웹훅이 바꿀 때까지 유지한다 */
  accessDeadline: Temporal.Instant | null;
  /** 활성이고 지우지 않은 계정인지. 아니면 읽기 권한 판단은 무료로 본다 */
  isActive: boolean;
  aiUsageCount: number;
  aiUsageResetAt: Temporal.Instant;
}

export class InMemoryAccessStateReader extends AccessStateReaderPort {
  readonly users: Map<string, InMemoryAccessUser>;
  /** 자리 저장소 대역과 같은 행을 읽어 지급한 자리가 바로 보인다 */
  readonly featureGrants: InMemoryFeatureGrantRepository;

  constructor(
    users: Map<string, InMemoryAccessUser> = new Map(),
    featureGrants: InMemoryFeatureGrantRepository = new InMemoryFeatureGrantRepository(),
  ) {
    super();
    this.users = users;
    this.featureGrants = featureGrants;
  }

  async findActiveUserAccessState(userId: UserId): Promise<AccessState | null> {
    const user = this.users.get(userId.value);
    return user?.isActive === true ? toAccessState(user) : null;
  }

  async findAccessState(userId: UserId): Promise<AccessState | null> {
    const user = this.users.get(userId.value);
    return user == null ? null : toAccessState(user);
  }

  async findFeatureGrants(userId: UserId): Promise<FeatureGrants> {
    return this.featureGrants.totalFor(userId.value);
  }
}

function toAccessState(user: InMemoryAccessUser): AccessState {
  return {
    role: user.role,
    subscriptionStatus: user.subscriptionStatus,
    accessDeadline: user.accessDeadline,
  };
}
