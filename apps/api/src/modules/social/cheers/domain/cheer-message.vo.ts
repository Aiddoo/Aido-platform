import { CHEER_LIMITS } from "@aido/api/vocabulary";

import { ValueObject } from "#api/shared/domain/model/value-object";

import { cheerMessageTooLong } from "./cheers.errors.js";

export class CheerMessage extends ValueObject<string> {
  static create(raw: string): CheerMessage {
    if (raw.length > CHEER_LIMITS.MAX_MESSAGE_LENGTH) {
      throw cheerMessageTooLong();
    }
    return new CheerMessage(raw);
  }

  static reconstitute(raw: string): CheerMessage {
    return new CheerMessage(raw);
  }
}
