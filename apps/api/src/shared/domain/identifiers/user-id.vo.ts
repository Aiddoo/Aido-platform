import { invalidUserId } from "#api/shared/domain/exceptions/shared-domain.errors";
import { createEntityId, EntityId } from "#api/shared/domain/model/entity-id";

export class UserId extends EntityId<string> {
  static create(raw: string): UserId {
    if (raw.length === 0) {
      throw invalidUserId();
    }
    return new UserId(raw);
  }

  static generate(): UserId {
    return new UserId(createEntityId());
  }

  static reconstitute(raw: string): UserId {
    return new UserId(raw);
  }
}
