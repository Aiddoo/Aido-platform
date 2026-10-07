import { ErrorCode } from "@aido/api/errors";
import { CHEER_LIMITS } from "@aido/api/vocabulary";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export class CheerMessage {
  private constructor(private readonly text: string | null) {}

  static of(value?: string | null): CheerMessage {
    if (value === null || value === undefined) {
      return new CheerMessage(null);
    }
    if (value.length > CHEER_LIMITS.MAX_MESSAGE_LENGTH) {
      throw new DomainException(ErrorCode.SYS_0002, {
        maxLength: CHEER_LIMITS.MAX_MESSAGE_LENGTH,
      });
    }
    return new CheerMessage(value);
  }

  get raw(): string | undefined {
    return this.text ?? undefined;
  }

  get value(): string | null {
    return this.text;
  }
}
