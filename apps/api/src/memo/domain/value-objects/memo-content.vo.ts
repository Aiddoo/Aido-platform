import { ErrorCode } from "@aido/errors";
import { MEMO_LIMITS } from "@aido/validators";
import { DomainException } from "@/shared/domain/exceptions/domain.exception";

/** 메모를 할 일로 변환할 때 제목 최대 길이 (초과 시 잘림). */
const TODO_TITLE_MAX_LENGTH = 200;

/**
 * 메모 내용 값 객체.
 *
 * 길이 불변식(1 ~ MAX_CONTENT_LENGTH)을 강제하고, 할 일 변환 시 제목 축약
 * 정책(앞 200자)을 소유한다.
 */
export class MemoContent {
	private constructor(private readonly _value: string) {}

	static of(value: string): MemoContent {
		if (value.length < 1 || value.length > MEMO_LIMITS.MAX_CONTENT_LENGTH) {
			throw new DomainException(ErrorCode.SYS_0002, {
				field: "content",
				length: value.length,
			});
		}
		return new MemoContent(value);
	}

	get value(): string {
		return this._value;
	}

	/** 할 일 제목으로 변환한다 (앞 200자로 축약). */
	toTodoTitle(): string {
		return this._value.substring(0, TODO_TITLE_MAX_LENGTH);
	}
}
