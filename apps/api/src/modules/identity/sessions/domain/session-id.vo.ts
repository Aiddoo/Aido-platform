import { EntityId } from "#api/shared/domain/model/entity-id";

export class SessionId extends EntityId<string> {
  static reconstitute(value: string): SessionId {
    return new SessionId(value);
  }
}
