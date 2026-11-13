import { NUDGE_LIMITS } from "@aido/api/vocabulary";

import { ValueObject } from "#api/shared/domain/model/value-object";

import { nudgeMessageTooLong } from "./nudges.errors.js";

// 리마인드 콕도 같은 길이 규칙을 쓴다
export class NudgeMessage extends ValueObject<string> {
  static create(raw: string): NudgeMessage {
    if (raw.length > NUDGE_LIMITS.MAX_MESSAGE_LENGTH) {
      throw nudgeMessageTooLong();
    }
    return new NudgeMessage(raw);
  }

  static reconstitute(raw: string): NudgeMessage {
    return new NudgeMessage(raw);
  }
}
