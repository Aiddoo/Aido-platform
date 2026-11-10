import { NUDGE_LIMITS } from "@aido/api/vocabulary";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

import { NudgeMessage } from "./nudge-message.vo.js";

describe("NudgeMessage", () => {
  it("메시지를 주지 않으면 raw는 undefined", () => {
    expect(NudgeMessage.of().raw).toBeUndefined();
  });

  it("유효한 메시지는 통과", () => {
    const msg = NudgeMessage.of("힘내!");
    expect(msg.raw).toBe("힘내!");
  });

  it("최대 길이 초과면 DomainException", () => {
    const tooLong = "a".repeat(NUDGE_LIMITS.MAX_MESSAGE_LENGTH + 1);
    expect(() => NudgeMessage.of(tooLong)).toThrow(DomainException);
  });

  it("최대 길이 경계값은 통과", () => {
    const exact = "a".repeat(NUDGE_LIMITS.MAX_MESSAGE_LENGTH);
    expect(NudgeMessage.of(exact).raw).toBe(exact);
  });
});
