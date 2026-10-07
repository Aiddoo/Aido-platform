import { ErrorCode } from "@aido/api/errors";
import { NUDGE_LIMITS } from "@aido/api/vocabulary";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export class NudgeMessage {
  private constructor(private readonly text: string | null) {}

  static of(value?: string | null): NudgeMessage {
    if (value === null || value === undefined) {
      return new NudgeMessage(null);
    }
    if (value.length > NUDGE_LIMITS.MAX_MESSAGE_LENGTH) {
      throw new DomainException(ErrorCode.SYS_0002, {
        maxLength: NUDGE_LIMITS.MAX_MESSAGE_LENGTH,
      });
    }
    return new NudgeMessage(value);
  }

  get raw(): string | undefined {
    return this.text ?? undefined;
  }

  get value(): string | null {
    return this.text;
  }
}
