import { ResourceBonusRepositoryPort } from "#api/modules/access/entitlements/application/ports/resource-bonus.repository.port";
import {
  BONUS_RESOURCES,
  type ResourceBonuses,
} from "#api/modules/access/entitlements/domain/entitlements.constants";
import { ResourceBonusId } from "#api/modules/access/entitlements/domain/resource-bonus-id.vo";
import type {
  ResourceBonus,
  ResourceBonusPrimitives,
} from "#api/modules/access/entitlements/domain/resource-bonus.aggregate";

export class InMemoryResourceBonusRepository extends ResourceBonusRepositoryPort {
  readonly #bonuses = new Map<string, ResourceBonusPrimitives>();
  #sequence = 0;

  get all(): readonly ResourceBonusPrimitives[] {
    return [...this.#bonuses.values()];
  }

  async nextId(): Promise<ResourceBonusId> {
    this.#sequence += 1;
    return ResourceBonusId.reconstitute(`generated-bonus-${this.#sequence}`);
  }

  async saveIfAbsent(bonus: ResourceBonus): Promise<boolean> {
    const primitives = bonus.toPrimitives();
    if (this.all.some((stored) => stored.sourceKey === primitives.sourceKey)) {
      return false;
    }
    this.#bonuses.set(primitives.id, primitives);
    return true;
  }

  /** 사용자의 리소스별 보너스 합계. 권한 상태 reader 대역이 읽는다 */
  totalFor(userId: string): ResourceBonuses {
    const totalOf = (resource: (typeof BONUS_RESOURCES)[number]) =>
      this.all
        .filter((bonus) => bonus.userId === userId && bonus.resource === resource)
        .reduce((sum, bonus) => sum + bonus.quantity, 0);
    return { FRIEND: totalOf("FRIEND") };
  }

  /** 이미 받은 보너스가 있는 상태를 만든다 */
  grant(userId: string, bonuses: ResourceBonuses): void {
    for (const resource of BONUS_RESOURCES) {
      if (bonuses[resource] > 0) {
        this.#sequence += 1;
        const id = `seeded-bonus-${this.#sequence}`;
        this.#bonuses.set(id, {
          id,
          userId,
          resource,
          quantity: bonuses[resource],
          sourceKey: id,
          createdAt: Temporal.Instant.fromEpochMilliseconds(0),
        });
      }
    }
  }
}
