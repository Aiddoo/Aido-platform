import { ErrorCode } from "@aido/api/errors";
import { CHEER_LIMITS } from "@aido/api/vocabulary";

import { CheerMessage } from "./cheer-message.vo.js";

describe("CheerMessage — 응원 메시지", () => {
  it.each(["", "화이팅!", "a".repeat(CHEER_LIMITS.MAX_MESSAGE_LENGTH)])(
    "상한 길이까지는 원문 그대로 담는다: %j",
    (raw) => {
      // When
      const message = CheerMessage.create(raw);

      // Then
      expect(message.value).toBe(raw);
    },
  );

  it("상한을 넘으면 SYS_0002와 최대 길이를 알려 준다", () => {
    // When
    const create = () => CheerMessage.create("a".repeat(CHEER_LIMITS.MAX_MESSAGE_LENGTH + 1));

    // Then
    expect(create).toThrow(
      expect.objectContaining({
        errorCode: ErrorCode.SYS_0002,
        details: { maxLength: CHEER_LIMITS.MAX_MESSAGE_LENGTH },
      }),
    );
  });
});
