import { ErrorCode } from "@aido/errors";

import { DomainException } from "@/shared/domain/exceptions/domain.exception";

const MAX_LENGTH = 50;

/**
 * CategoryName — 카테고리 이름 값 객체.
 *
 * 1~50자 불변식(DB VarChar(50)·zod와 동일 상한)을 소유한다. 프레젠테이션(zod)에서 이미 검증되지만
 * 도메인 경계에서도 방어한다(동일 상한이라 유효 입력은 통과).
 */
export class CategoryName {
	private constructor(private readonly text: string) {}

	static of(value: string): CategoryName {
		if (value.length < 1 || value.length > MAX_LENGTH) {
			throw new DomainException(ErrorCode.SYS_0002, { maxLength: MAX_LENGTH });
		}
		return new CategoryName(value);
	}

	get value(): string {
		return this.text;
	}
}
