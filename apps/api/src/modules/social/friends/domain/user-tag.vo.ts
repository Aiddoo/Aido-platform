import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { ValueObject } from "#api/shared/domain/model/value-object";

const USER_TAG_PATTERN = /^[A-Z0-9]{8}$/;

export class UserTag extends ValueObject<string> {
  static create(raw: string): UserTag {
    if (!USER_TAG_PATTERN.test(raw)) {
      throw new DomainException(ErrorCode.SYS_0002, { userTag: raw });
    }
    return new UserTag(raw);
  }

  static reconstitute(raw: string): UserTag {
    return new UserTag(raw);
  }
}
