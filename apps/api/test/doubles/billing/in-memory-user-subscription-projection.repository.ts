import {
  type ListLapsedPremiumUsersParams,
  type UserSubscriptionProjection,
  UserSubscriptionProjectionRepositoryPort,
} from "#api/modules/billing/premium-grants/application/ports/user-subscription-projection.repository.port";
import { DatabaseRecordNotFoundError } from "#api/platform/database/database-error.util";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// User 행의 구독 projection을 userId별로 둔다. 없는 사용자는 DB처럼 부재 오류다
export class InMemoryUserSubscriptionProjectionRepository extends UserSubscriptionProjectionRepositoryPort {
  readonly projections = new Map<string, UserSubscriptionProjection>();
  readonly lapsedUserIds: UserId[] = [];

  constructor(knownUserIds: readonly string[]) {
    super();
    for (const userId of knownUserIds) {
      this.projections.set(userId, { subscriptionStatus: "FREE", subscriptionExpiresAt: null });
    }
  }

  async update(userId: UserId, projection: UserSubscriptionProjection): Promise<void> {
    if (!this.projections.has(userId.value)) {
      throw new DatabaseRecordNotFoundError();
    }
    this.projections.set(userId.value, projection);
  }

  async listLapsedPremiumUserIds(params: ListLapsedPremiumUsersParams): Promise<UserId[]> {
    return this.lapsedUserIds
      .filter((userId) => params.afterUserId == null || userId.value > params.afterUserId.value)
      .slice(0, params.limit);
  }
}
