import { ErrorCode } from "@aido/errors";
import { DomainException, ValueObject } from "@/common/domain";

/** 제목 불변식 (Zod 경계 검증과 동일 규칙 — 도메인 자기방어) */
const TITLE_MIN_LENGTH = 1;
const TITLE_MAX_LENGTH = 200;

/**
 * Todo 제목 VO
 *
 * 길이 불변식을 생성 시점에 강제합니다. create/updateDetails 등
 * 제목이 도메인에 들어오는 모든 경로가 이 VO를 통과해야 합니다.
 */
export class TodoTitle extends ValueObject<string> {
	static create(title: string): TodoTitle {
		if (title.length < TITLE_MIN_LENGTH || title.length > TITLE_MAX_LENGTH) {
			throw new DomainException(
				ErrorCode.SYS_0002,
				{ titleLength: title.length, max: TITLE_MAX_LENGTH },
				`제목은 ${TITLE_MIN_LENGTH}~${TITLE_MAX_LENGTH}자여야 합니다.`,
			);
		}
		return new TodoTitle(title);
	}
}
