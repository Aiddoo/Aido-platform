import { createHash } from "node:crypto";

import { VERIFICATION_CODE } from "@aido/validators";

import { NodeVerificationCodeSecurityAdapter } from "./node-verification-code-security.adapter";

describe("NodeVerificationCodeSecurityAdapter", () => {
	const adapter = new NodeVerificationCodeSecurityAdapter();

	it("암호학적으로 안전한 고정 길이 숫자 코드와 SHA-256 digest를 만든다", () => {
		const generatedCode = adapter.generate();

		expect(generatedCode.plaintext).toMatch(new RegExp(`^\\d{${VERIFICATION_CODE.LENGTH}}$`));
		expect(generatedCode.digest).toBe(
			createHash("sha256").update(generatedCode.plaintext).digest("hex"),
		);
	});

	it("같은 평문은 같은 SHA-256 digest로 변환한다", () => {
		expect(adapter.hash("123456")).toBe(createHash("sha256").update("123456").digest("hex"));
	});
});
