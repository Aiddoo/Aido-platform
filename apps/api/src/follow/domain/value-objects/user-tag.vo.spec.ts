import { DomainException } from "@/shared/domain/exceptions/domain.exception";
import { UserTag } from "./user-tag.vo";

describe("UserTag VO", () => {
	it("8자리 영숫자 대문자를 허용한다", () => {
		expect(UserTag.of("JOHN2026").value).toBe("JOHN2026");
		expect(UserTag.of("ABCDEFGH").value).toBe("ABCDEFGH");
		expect(UserTag.of("12345678").value).toBe("12345678");
	});

	it("형식이 틀리면 DomainException", () => {
		expect(() => UserTag.of("john2026")).toThrow(DomainException); // 소문자
		expect(() => UserTag.of("SHORT")).toThrow(DomainException); // 8자 미만
		expect(() => UserTag.of("TOOLONG123")).toThrow(DomainException); // 8자 초과
		expect(() => UserTag.of("JOHN-202")).toThrow(DomainException); // 특수문자
	});

	it("equals", () => {
		expect(UserTag.of("JOHN2026").equals(UserTag.of("JOHN2026"))).toBe(true);
		expect(UserTag.of("JOHN2026").equals(UserTag.of("JANE2026"))).toBe(false);
	});
});
