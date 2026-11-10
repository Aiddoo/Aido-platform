import type { ResourceBonusId } from "../../domain/resource-bonus-id.vo.js";
import type { ResourceBonus } from "../../domain/resource-bonus.aggregate.js";

export abstract class ResourceBonusRepositoryPort {
  abstract nextId(): Promise<ResourceBonusId>;
  /** 같은 sourceKey가 이미 있으면 저장하지 않고 false를 반환한다. */
  abstract saveIfAbsent(bonus: ResourceBonus): Promise<boolean>;
}
