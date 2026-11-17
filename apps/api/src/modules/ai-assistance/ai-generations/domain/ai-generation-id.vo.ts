import { createEntityId, EntityId } from "#api/shared/domain/model/entity-id";

export class AiGenerationId extends EntityId<string> {
  static generate(): AiGenerationId {
    return new AiGenerationId(createEntityId());
  }
}
