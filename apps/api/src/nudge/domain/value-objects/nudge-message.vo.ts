import { ErrorCode } from "@aido/errors";
import { NUDGE_LIMITS } from "@aido/validators";

import { DomainException } from "@/shared/domain/exceptions/domain.exception";

/**
 * NudgeMessage — 콕 찌르기 메시지 값 객체.
 *
 * 선택적 메시지의 최대 길이 불변식(NUDGE_LIMITS.MAX_MESSAGE_LENGTH)을 소유한다.
 * 프레젠테이션(zod)에서 이미 검증되지만 도메인 경계에서도 방어한다(동일 상한이라 유효 입력은 통과).
 */
export class NudgeMessage {
	private constructor(private readonly text: string | null) {}

	static of(value?: string | null): NudgeMessage {
		if (value == null) {
			return new NudgeMessage(null);
		}
		if (value.length > NUDGE_LIMITS.MAX_MESSAGE_LENGTH) {
			throw new DomainException(ErrorCode.SYS_0002, {
				maxLength: NUDGE_LIMITS.MAX_MESSAGE_LENGTH,
			});
		}
		return new NudgeMessage(value);
	}

	/** 저장/전송용 원시값 (미설정 시 undefined — Prisma 기본값 유지) */
	get raw(): string | undefined {
		return this.text ?? undefined;
	}

	get value(): string | null {
		return this.text;
	}
}
