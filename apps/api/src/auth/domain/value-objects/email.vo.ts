import { ErrorCode } from "@aido/errors";
import { z } from "@aido/validators";

import { DomainException } from "@/shared/domain/exceptions/domain.exception";

/**
 * 이메일 형식 검증 스키마.
 *
 * @aido/validators `emailSchema`의 형식 규칙(z.email + 최대 255자)과 동일한 원시
 * (z.email())를 사용해 정규식 드리프트를 배제한다. 정규화(trim·소문자화)는
 * 프레젠테이션 계층(emailSchema)이 소유하므로 여기서는 다시 수행하지 않는다
 * → 이미 정규화·검증을 통과한 입력에 대해 `.value === 입력`(byte-identical).
 */
const EMAIL_FORMAT = z.email().pipe(z.string().max(255));

/**
 * Email — 이메일 주소 값 객체.
 *
 * 크리덴셜 로그인/회원가입 경로에서 사용자 입력 이메일의 형식 불변식을 도메인
 * 경계에서 방어적으로 강제한다(프레젠테이션 zod에서 이미 검증되지만 UserTag VO와
 * 동일하게 도메인에서도 형식을 보장). 정규화는 하지 않으므로 유효 입력은 값 그대로
 * 통과한다. 소셜 로그인의 합성 이메일(provider_id@social.aido.kr)은 이 경계를 거치지
 * 않는다(기존 동작 보존).
 */
export class Email {
	private constructor(private readonly address: string) {}

	static of(value: string): Email {
		const result = EMAIL_FORMAT.safeParse(value);
		if (!result.success) {
			throw new DomainException(ErrorCode.SYS_0002, { email: value });
		}
		return new Email(result.data);
	}

	get value(): string {
		return this.address;
	}

	equals(other: Email): boolean {
		return this.address === other.address;
	}
}
