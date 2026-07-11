import { ErrorCode } from "@aido/errors";
import { CHEER_LIMITS } from "@aido/validators";

import { DomainException } from "@/shared/domain/exceptions/domain.exception";

/**
 * CheerMessage — 응원 메시지 값 객체.
 *
 * 선택적 메시지의 최대 길이 불변식(CHEER_LIMITS.MAX_MESSAGE_LENGTH)을 소유한다.
 * 프레젠테이션(zod)에서 이미 검증되지만 도메인 경계에서도 방어한다(동일 상한이라 유효 입력은 통과).
 */
export class CheerMessage {
	private constructor(private readonly text: string | null) {}

	static of(value?: string | null): CheerMessage {
		if (value == null) {
			return new CheerMessage(null);
		}
		if (value.length > CHEER_LIMITS.MAX_MESSAGE_LENGTH) {
			throw new DomainException(ErrorCode.SYS_0002, {
				maxLength: CHEER_LIMITS.MAX_MESSAGE_LENGTH,
			});
		}
		return new CheerMessage(value);
	}

	/** 저장/전송용 원시값 (미설정 시 undefined — Prisma 기본값 유지) */
	get raw(): string | undefined {
		return this.text ?? undefined;
	}

	get value(): string | null {
		return this.text;
	}
}
