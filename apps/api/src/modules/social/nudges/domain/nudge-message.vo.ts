import { ErrorCode } from "@aido/api/errors";
import { NUDGE_LIMITS } from "@aido/api/vocabulary";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export class NudgeMessage {
  readonly raw: string | undefined;

  constructor(raw: string | undefined) {
    this.raw = raw;
  }

  static of(value?: string): NudgeMessage {
    if (value == null) {
      return new NudgeMessage(undefined);
    }
    if (value.length > NUDGE_LIMITS.MAX_MESSAGE_LENGTH) {
      throw new DomainException(ErrorCode.SYS_0002, {
        maxLength: NUDGE_LIMITS.MAX_MESSAGE_LENGTH,
      });
    }
    return new NudgeMessage(value);
  }
}
