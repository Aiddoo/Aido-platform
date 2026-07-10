import { ErrorCode } from "@aido/errors";

import { DomainException } from "@/shared/domain/exceptions/domain.exception";

/** HEX 색상 코드 형식 (#RRGGBB) — @aido/validators의 hexColorRegex와 동일 */
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

/**
 * CategoryColor — 카테고리 색상 값 객체.
 *
 * HEX 색상 코드(#RRGGBB) 형식 불변식을 소유한다. 프레젠테이션(zod)에서 이미 검증되지만 도메인
 * 경계에서도 방어한다(동일 정규식이라 유효 입력은 통과).
 */
export class CategoryColor {
	private constructor(private readonly hex: string) {}

	static of(value: string): CategoryColor {
		if (!HEX_COLOR.test(value)) {
			throw new DomainException(ErrorCode.SYS_0002, {
				message: "HEX 색상 코드 형식이 아닙니다",
			});
		}
		return new CategoryColor(value);
	}

	get value(): string {
		return this.hex;
	}
}
