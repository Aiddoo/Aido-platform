import { randomBytes } from "node:crypto";

import { EntityId } from "#api/shared/domain/model/entity-id";

export class PlanApplicationId extends EntityId<string> {
  // DB 기본값(createEntityId)과 같은 c 접두사·25자 형식
  static generate(): PlanApplicationId {
    return new PlanApplicationId(`c${randomBytes(12).toString("hex")}`);
  }

  static reconstitute(value: string): PlanApplicationId {
    return new PlanApplicationId(value);
  }
}
