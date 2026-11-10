import { ResourceBonusRepositoryPort } from "#api/modules/access/entitlements/application/ports/resource-bonus.repository.port";
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
}
