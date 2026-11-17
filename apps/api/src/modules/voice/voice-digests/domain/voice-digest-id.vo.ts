import { createEntityId, EntityId } from "#api/shared/domain/model/entity-id";

export class VoiceDigestId extends EntityId<string> {
  static generate(): VoiceDigestId {
    return new VoiceDigestId(createEntityId());
  }
}
