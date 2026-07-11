import { NUDGE_LIMITS } from "@aido/validators";

import { DomainException } from "@/shared/domain/exceptions/domain.exception";
import { NudgeMessage } from "./nudge-message.vo";

describe("NudgeMessage", () => {
	it("null/undefined이면 raw는 undefined", () => {
		expect(NudgeMessage.of().raw).toBeUndefined();
		expect(NudgeMessage.of(null).raw).toBeUndefined();
		expect(NudgeMessage.of(null).value).toBeNull();
	});

	it("유효한 메시지는 통과", () => {
		const msg = NudgeMessage.of("힘내!");
		expect(msg.raw).toBe("힘내!");
		expect(msg.value).toBe("힘내!");
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
