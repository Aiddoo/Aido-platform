import type { DayOfWeek, Todo } from "@aido/validators";
import { Command } from "@nestjs/cqrs";

/** 일괄 변환 단일 항목 입력 (컨트롤러가 날짜/시간을 파싱해 전달). */
export interface ConvertMemoToSingleTodoData {
	title: string;
	categoryId: number;
	startDate: Date;
	endDate?: Date | null;
	scheduledTime?: Date | null;
	isAllDay?: boolean;
	visibility?: "PUBLIC" | "PRIVATE";
	isRecurring?: boolean;
	recurrence?: {
		daysOfWeek: DayOfWeek[];
		endDate: Date;
	};
	items?: { title: string }[];
}

/** 일괄 변환 입력. */
export interface ConvertMemoToTodosData {
	todos: ConvertMemoToSingleTodoData[];
}

/** 일괄 변환 결과. */
export interface ConvertMemoToTodosResult {
	message: string;
	todos: Todo[];
}

/** 메모를 여러 할 일로 일괄 변환하는 커맨드 (변환 후 메모 삭제). */
export class ConvertMemoToTodosCommand extends Command<ConvertMemoToTodosResult> {
	constructor(
		public readonly userId: string,
		public readonly memoId: number,
		public readonly data: ConvertMemoToTodosData,
		public readonly timezone: string = "UTC",
	) {
		super();
	}
}
