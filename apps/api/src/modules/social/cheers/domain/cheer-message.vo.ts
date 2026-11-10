import { ErrorCode } from "@aido/api/errors";
import { CHEER_LIMITS } from "@aido/api/vocabulary";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { ValueObject } from "#api/shared/domain/model/value-object";

export class CheerMessage extends ValueObject<string> {
  static create(raw: string): CheerMessage {
    if (raw.length > CHEER_LIMITS.MAX_MESSAGE_LENGTH) {
      throw new DomainException(ErrorCode.SYS_0002, {
        maxLength: CHEER_LIMITS.MAX_MESSAGE_LENGTH,
      });
    }
    return new CheerMessage(raw);
  }

  static reconstitute(raw: string): CheerMessage {
    return new CheerMessage(raw);
  }
}
