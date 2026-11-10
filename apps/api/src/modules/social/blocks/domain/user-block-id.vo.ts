import { EntityId } from "#api/shared/domain/model/entity-id";

export class UserBlockId extends EntityId<string> {
  static reconstitute(value: string): UserBlockId {
    return new UserBlockId(value);
  }
}
