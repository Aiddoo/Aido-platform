import type { Memo as MemoResponse } from "@aido/validators";
import { AggregateRoot } from "@/shared/domain";
import { toISOString } from "@/shared/domain/date/utils/format";
import { MemoContent } from "../value-objects/memo-content.vo";

/**
 * 메모 애그리게잇.
 *
 * 내용(값 객체)·고정 여부·수동 정렬 순서를 소유한다. 조회/변환에 필요한 파생값
 * (응답 뷰, 할 일 제목)을 자기 자신에서 직렬화한다.
 */
interface MemoProps {
	id: number;
	userId: string;
	content: MemoContent;
	isPinned: boolean;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date;
}

export class Memo extends AggregateRoot<MemoProps> {
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
		return new Memo({
			...props,
			content: MemoContent.of(props.content),
			createdAt: new Date(props.createdAt),
			updatedAt: new Date(props.updatedAt),
		});
	}

	get id(): number {
		return this.props.id;
	}

	get userId(): string {
		return this.props.userId;
	}

	get content(): MemoContent {
		return this.props.content;
	}

	get isPinned(): boolean {
		return this.props.isPinned;
	}

	get sortOrder(): number {
		return this.props.sortOrder;
	}

	rename(content: string): void {
		this.props.content = MemoContent.of(content);
	}

	setPinned(isPinned: boolean): void {
		this.props.isPinned = isPinned;
	}

	/** 할 일 변환용 제목(앞 200자). */
	toTodoTitle(): string {
		return this.props.content.toTodoTitle();
	}

	/** 응답 뷰(@aido/validators Memo)로 직렬화한다. */
	toView(): MemoResponse {
		return {
			id: this.props.id,
			userId: this.props.userId,
			content: this.props.content.value,
			isPinned: this.props.isPinned,
			sortOrder: this.props.sortOrder,
			createdAt: toISOString(this.props.createdAt),
			updatedAt: toISOString(this.props.updatedAt),
		};
	}
}
