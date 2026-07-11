import { createHash } from "node:crypto";

import { VERIFICATION_CODE } from "@aido/validators";

import { VerificationCode } from "./verification-code.vo";

describe("VerificationCode 값 객체", () => {
	describe("generate", () => {
		it("VERIFICATION_CODE.LENGTH 자리 숫자 평문을 생성한다", () => {
			const code = VerificationCode.generate();
			expect(code.value).toMatch(
				new RegExp(`^\\d{${VERIFICATION_CODE.LENGTH}}$`),
			);
		});

		it("hash는 평문의 SHA-256 hex와 일치한다", () => {
			const code = VerificationCode.generate();
			const expected = createHash("sha256").update(code.value).digest("hex");
			expect(code.hash).toBe(expected);
		});

		it("생성 시 서로 다른 평문이 나올 수 있다(암호학적 난수)", () => {
			const codes = new Set(
				Array.from({ length: 20 }, () => VerificationCode.generate().value),
			);
			// 20회 중 최소 2개 이상 서로 달라야 한다(충돌만 있으면 안 됨)
			expect(codes.size).toBeGreaterThan(1);
		});
	});

	describe("hashOf", () => {
		it("동일 평문은 동일 해시를 만든다(결정적)", () => {
			expect(VerificationCode.hashOf("123456")).toBe(
				VerificationCode.hashOf("123456"),
			);
		});

		it("SHA-256 hex(64자)를 반환한다", () => {
			const hash = VerificationCode.hashOf("123456");
			expect(hash).toBe(createHash("sha256").update("123456").digest("hex"));
			expect(hash).toMatch(/^[0-9a-f]{64}$/);
		});
	});
});
