import { VerificationCode } from "./verification-code.vo";

describe("VerificationCode 값 객체", () => {
	it("평문과 저장용 digest를 하나의 불변 값으로 보관한다", () => {
		const verificationCode = VerificationCode.create("123456", "digest");

		expect(verificationCode.value).toBe("123456");
		expect(verificationCode.hash).toBe("digest");
	});
});
