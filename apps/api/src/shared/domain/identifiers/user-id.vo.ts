import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { EntityId } from "#api/shared/domain/model/entity-id";

export class UserId extends EntityId<string> {
  static create(raw: string): UserId {
    if (raw.length === 0) {
      throw new DomainException(ErrorCode.SYS_0002, { field: "userId" });
    }
    return new UserId(raw);
  }

  static reconstitute(raw: string): UserId {
    return new UserId(raw);
  }
}
