import type { Todo } from "@aido/validators";
import { Command } from "@nestjs/cqrs";

/** 단건 변환 입력 (컨트롤러가 날짜/시간을 파싱해 전달). */
export interface ConvertMemoToTodoData {
	categoryId: number;
	startDate: Date;
	endDate?: Date | null;
	scheduledTime?: Date | null;
	isAllDay?: boolean;
	visibility?: "PUBLIC" | "PRIVATE";
	items?: { title: string }[];
}

/** 단건 변환 결과. */
export interface ConvertMemoToTodoResult {
	message: string;
	todo: Todo;
}

/** 메모를 단일 할 일로 변환하는 커맨드 (변환 후 메모 삭제). */
export class ConvertMemoToTodoCommand extends Command<ConvertMemoToTodoResult> {
	constructor(
		public readonly userId: string,
		public readonly memoId: number,
		public readonly data: ConvertMemoToTodoData,
	) {
		super();
	}
}
