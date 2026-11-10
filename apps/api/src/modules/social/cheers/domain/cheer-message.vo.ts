import { ErrorCode } from "@aido/api/errors";
import { CHEER_LIMITS } from "@aido/api/vocabulary";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export class CheerMessage {
  readonly raw: string | undefined;

  constructor(raw: string | undefined) {
    this.raw = raw;
  }

  static of(value?: string): CheerMessage {
    if (value == null) {
      return new CheerMessage(undefined);
    }
    if (value.length > CHEER_LIMITS.MAX_MESSAGE_LENGTH) {
      throw new DomainException(ErrorCode.SYS_0002, {
        maxLength: CHEER_LIMITS.MAX_MESSAGE_LENGTH,
      });
    }
    return new CheerMessage(value);
  }
}
