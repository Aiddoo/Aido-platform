import { GRANTABLE_FEATURE_KEYS, type GrantableFeature } from "@aido/api/vocabulary";

import { FeatureGrantRepositoryPort } from "#api/modules/access/entitlements/application/ports/feature-grant.repository.port";
import type { FeatureGrants } from "#api/modules/access/entitlements/domain/entitlements.constants";
import { FeatureGrantId } from "#api/modules/access/entitlements/domain/feature-grant-id.vo";
import type {
  FeatureGrant,
  FeatureGrantPrimitives,
} from "#api/modules/access/entitlements/domain/feature-grant.aggregate";

export class InMemoryFeatureGrantRepository extends FeatureGrantRepositoryPort {
  readonly #grants = new Map<string, FeatureGrantPrimitives>();
  #sequence = 0;

  get all(): readonly FeatureGrantPrimitives[] {
    return [...this.#grants.values()];
  }

  async nextId(): Promise<FeatureGrantId> {
    this.#sequence += 1;
    return FeatureGrantId.reconstitute(`generated-grant-${this.#sequence}`);
  }

  async saveIfAbsent(grant: FeatureGrant): Promise<boolean> {
    const primitives = grant.toPrimitives();
    if (this.all.some((stored) => stored.sourceKey === primitives.sourceKey)) {
      return false;
    }
    this.#grants.set(primitives.id, primitives);
    return true;
  }

  /** 사용자의 기능별 자리 합계. Drizzle reader처럼 1 이상인 지급만 더하고 받은 것이 없는 기능은 뺀다 */
  totalFor(userId: string): FeatureGrants {
    const totalOf = (feature: GrantableFeature) =>
      this.all
        .filter(
          (grant) => grant.userId === userId && grant.feature === feature && grant.quantity > 0,
        )
        .reduce((sum, grant) => sum + grant.quantity, 0);
    return Object.fromEntries(
      GRANTABLE_FEATURE_KEYS.flatMap((feature) => {
        const total = totalOf(feature);
        return total > 0 ? [[feature, total] as const] : [];
      }),
    );
  }

  /** 이미 받은 자리가 있는 상태를 만든다. 검증 없이 저장된 행처럼 넣으므로 0·음수도 넣을 수 있다 */
  seed(userId: string, grants: FeatureGrants): void {
    for (const feature of GRANTABLE_FEATURE_KEYS) {
      const quantity = grants[feature];
      if (quantity != null) {
        this.#sequence += 1;
        const id = `seeded-grant-${this.#sequence}`;
        this.#grants.set(id, {
          id,
          userId,
          feature,
          quantity,
          sourceKey: id,
          createdAt: Temporal.Instant.fromEpochMilliseconds(0),
        });
      }
    }
  }
}
