import { ErrorCode } from "@aido/errors";

import { DomainException } from "@/shared/domain/exceptions/domain.exception";

/** 사용자 태그 형식: 8자리 영문 대문자/숫자 (@aido/validators userTagParamSchema와 동일) */
const USER_TAG_PATTERN = /^[A-Z0-9]{8}$/;

/**
 * UserTag — 사용자 태그 값 객체.
 *
 * 8자리 영숫자 대문자 형식 불변식을 소유한다. 프레젠테이션(zod)에서 이미 검증되지만,
 * 도메인 경계에서도 형식을 강제해 방어한다(동일 정규식이라 유효 입력은 통과).
 */
export class UserTag {
	private constructor(private readonly tag: string) {}

	static of(value: string): UserTag {
		if (!USER_TAG_PATTERN.test(value)) {
			throw new DomainException(ErrorCode.SYS_0002, { userTag: value });
		}
		return new UserTag(value);
	}

	get value(): string {
		return this.tag;
	}

	equals(other: UserTag): boolean {
		return this.tag === other.tag;
	}
}
