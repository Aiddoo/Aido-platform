import type { Memo as MemoResponse } from "@aido/validators";
import { toISOString } from "@/shared/domain/date/utils/format";
import { MemoContent } from "../value-objects/memo-content.vo";

/**
 * 메모 애그리게잇.
 *
 * 내용(값 객체)·고정 여부·수동 정렬 순서를 소유한다. 조회/변환에 필요한 파생값
 * (응답 뷰, 할 일 제목)을 자기 자신에서 직렬화한다.
 */
export class Memo {
	private constructor(
		private readonly _id: number,
		private readonly _userId: string,
		private readonly _content: MemoContent,
		private readonly _isPinned: boolean,
		private readonly _sortOrder: number,
		private readonly _createdAt: Date,
		private readonly _updatedAt: Date,
	) {}

	/** 저장된 값에서 복원한다. */
	static reconstitute(props: {
		id: number;
		userId: string;
		content: string;
		isPinned: boolean;
		sortOrder: number;
		createdAt: Date;
		updatedAt: Date;
	}): Memo {
		return new Memo(
			props.id,
			props.userId,
			MemoContent.of(props.content),
			props.isPinned,
			props.sortOrder,
			props.createdAt,
			props.updatedAt,
		);
	}

	get id(): number {
		return this._id;
	}

	get userId(): string {
		return this._userId;
	}

	get content(): MemoContent {
		return this._content;
	}

	get isPinned(): boolean {
		return this._isPinned;
	}

	get sortOrder(): number {
		return this._sortOrder;
	}

	/** 할 일 변환용 제목(앞 200자). */
	toTodoTitle(): string {
		return this._content.toTodoTitle();
	}

	/** 응답 뷰(@aido/validators Memo)로 직렬화한다. */
	toView(): MemoResponse {
		return {
			id: this._id,
			userId: this._userId,
			content: this._content.value,
			isPinned: this._isPinned,
			sortOrder: this._sortOrder,
			createdAt: toISOString(this._createdAt),
			updatedAt: toISOString(this._updatedAt),
		};
	}
}
