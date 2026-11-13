import { ErrorCode } from "@aido/api/errors";
import { NUDGE_LIMITS } from "@aido/api/vocabulary";

import { NudgeMessage } from "./nudge-message.vo.js";

describe("NudgeMessage — 콕 메시지", () => {
  it("상한 길이까지는 원문 그대로 담는다", () => {
    // Given
    const exact = "a".repeat(NUDGE_LIMITS.MAX_MESSAGE_LENGTH);

    // When
    const message = NudgeMessage.create(exact);

    // Then
    expect(message.value).toBe(exact);
  });

  it("상한을 넘으면 SYS_0002와 최대 길이를 알려 준다", () => {
    // When
    const create = () => NudgeMessage.create("가".repeat(NUDGE_LIMITS.MAX_MESSAGE_LENGTH + 1));

    // Then
    expect(create).toThrow(
      expect.objectContaining({
        errorCode: ErrorCode.SYS_0002,
        details: { maxLength: NUDGE_LIMITS.MAX_MESSAGE_LENGTH },
      }),
    );
  });
});
