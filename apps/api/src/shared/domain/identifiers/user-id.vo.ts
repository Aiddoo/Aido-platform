import { invalidUserId } from "#api/shared/domain/exceptions/shared-domain.errors";
import { EntityId } from "#api/shared/domain/model/entity-id";

export class UserId extends EntityId<string> {
  static create(raw: string): UserId {
    if (raw.length === 0) {
      throw invalidUserId();
    }
    return new UserId(raw);
  }

  static reconstitute(raw: string): UserId {
    return new UserId(raw);
  }
}
