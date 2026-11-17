import { createEntityId, EntityId } from "#api/shared/domain/model/entity-id";

export class ActionPlanDraftId extends EntityId<string> {
  static generate(): ActionPlanDraftId {
    return new ActionPlanDraftId(createEntityId());
  }
}
