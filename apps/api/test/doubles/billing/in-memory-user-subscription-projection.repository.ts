import {
  type ListLapsedPremiumUsersParams,
  type UserSubscriptionProjection,
  UserSubscriptionProjectionRepositoryPort,
} from "#api/modules/billing/premium-grants/application/ports/user-subscription-projection.repository.port";
import { DatabaseRecordNotFoundError } from "#api/platform/database/database-error.util";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

interface SeedUserInput extends UserSubscriptionProjection {
  readonly id: string;
  readonly deleted?: boolean;
}

// User 행의 구독 projection을 userId별로 둔다. 없는 사용자는 DB처럼 부재 오류다
export class InMemoryUserSubscriptionProjectionRepository extends UserSubscriptionProjectionRepositoryPort {
  readonly projections = new Map<string, UserSubscriptionProjection>();
  readonly #deletedUserIds = new Set<string>();

  constructor(knownUserIds: readonly string[]) {
    super();
    for (const userId of knownUserIds) {
      this.projections.set(userId, { subscriptionStatus: "FREE", subscriptionExpiresAt: null });
    }
  }

  async seedUser(input: SeedUserInput): Promise<void> {
    this.projections.set(input.id, {
      subscriptionStatus: input.subscriptionStatus,
      subscriptionExpiresAt: input.subscriptionExpiresAt ?? null,
    });
    if (input.deleted === true) {
      this.#deletedUserIds.add(input.id);
    }
  }

  async update(userId: UserId, projection: UserSubscriptionProjection): Promise<void> {
    const current = this.projections.get(userId.value);
    if (current == null) {
      throw new DatabaseRecordNotFoundError();
    }
    // 생략한 만료 시각은 DB UPDATE처럼 저장값을 둔다
    this.projections.set(userId.value, {
      subscriptionStatus: projection.subscriptionStatus,
      subscriptionExpiresAt:
        projection.subscriptionExpiresAt === undefined
          ? current.subscriptionExpiresAt
          : projection.subscriptionExpiresAt,
    });
  }

  async listLapsedPremiumUserIds(params: ListLapsedPremiumUsersParams): Promise<UserId[]> {
    return [...this.projections]
      .filter(([userId, projection]) => {
        const expiresAt = projection.subscriptionExpiresAt;
        return (
          projection.subscriptionStatus === "ACTIVE" &&
          !this.#deletedUserIds.has(userId) &&
          expiresAt != null &&
          Temporal.Instant.compare(expiresAt, params.now) <= 0 &&
          (params.afterUserId == null || userId > params.afterUserId.value)
        );
      })
      .map(([userId]) => userId)
      .sort()
      .slice(0, params.limit)
      .map((userId) => UserId.reconstitute(userId));
  }
}
