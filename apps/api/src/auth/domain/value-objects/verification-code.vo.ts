import { createHash, randomInt } from "node:crypto";

import { VERIFICATION_CODE } from "@aido/validators";

/**
 * VerificationCode — 이메일 인증/비밀번호 재설정용 6자리 인증 코드 값 객체.
 *
 * "인증 코드란 무엇인가"라는 도메인 개념을 소유한다:
 * - 생성: 암호학적으로 안전한 6자리 숫자(VERIFICATION_CODE.LENGTH)
 * - 저장: 평문이 아닌 SHA-256 해시로 보관(DB에는 해시만 저장)
 * - 검증: 제출된 평문을 동일 해시로 변환해 저장된 해시와 비교
 *
 * 평문(value)은 생성 시점에만 존재하며 이메일로 전달된다. DB에는 hash만 저장된다.
 */
export class VerificationCode {
	private constructor(
		private readonly plaintext: string,
		private readonly digest: string,
	) {}

	/** 새 인증 코드를 생성한다(평문 + 해시). */
	static generate(): VerificationCode {
		// randomInt는 암호학적으로 안전한 난수 생성
		const min = 10 ** (VERIFICATION_CODE.LENGTH - 1); // 100000
		const max = 10 ** VERIFICATION_CODE.LENGTH; // 1000000
		const plaintext = randomInt(min, max).toString();
		return new VerificationCode(plaintext, VerificationCode.hashOf(plaintext));
	}

	/** 제출된 평문 코드를 저장된 해시와 비교하기 위한 SHA-256 해시(hex). */
	static hashOf(plaintext: string): string {
		return createHash("sha256").update(plaintext).digest("hex");
	}

	/** 이메일로 전달할 평문 코드. */
	get value(): string {
		return this.plaintext;
	}

	/** DB에 저장할 해시. */
	get hash(): string {
		return this.digest;
	}
}
