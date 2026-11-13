import { createEntityId, EntityId } from "#api/shared/domain/model/entity-id";

export class PlanApplicationId extends EntityId<string> {
  static generate(): PlanApplicationId {
    return new PlanApplicationId(createEntityId());
  }

  static reconstitute(value: string): PlanApplicationId {
    return new PlanApplicationId(value);
  }
}
