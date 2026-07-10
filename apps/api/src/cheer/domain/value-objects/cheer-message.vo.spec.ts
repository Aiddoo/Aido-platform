import { CHEER_LIMITS } from "@aido/validators";

import { DomainException } from "@/shared/domain/exceptions/domain.exception";
import { CheerMessage } from "./cheer-message.vo";

describe("CheerMessage VO", () => {
	it("null/undefined이면 빈 값", () => {
		expect(CheerMessage.of().value).toBeNull();
		expect(CheerMessage.of(null).value).toBeNull();
		expect(CheerMessage.of().raw).toBeUndefined();
	});

	it("일반 메시지를 담는다", () => {
		expect(CheerMessage.of("화이팅!").value).toBe("화이팅!");
		expect(CheerMessage.of("화이팅!").raw).toBe("화이팅!");
	});

	it("상한 길이는 허용", () => {
		const max = "a".repeat(CHEER_LIMITS.MAX_MESSAGE_LENGTH);
		expect(CheerMessage.of(max).value).toBe(max);
	});

	it("상한 초과면 DomainException", () => {
		const tooLong = "a".repeat(CHEER_LIMITS.MAX_MESSAGE_LENGTH + 1);
		expect(() => CheerMessage.of(tooLong)).toThrow(DomainException);
	});
});
