import { ErrorCode } from "@aido/api/errors";
import { USER_TAG_LENGTH } from "@aido/api/vocabulary";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { ValueObject } from "#api/shared/domain/model/value-object";

const USER_TAG_PATTERN = new RegExp(`^[A-Z0-9]{${USER_TAG_LENGTH}}$`);

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
