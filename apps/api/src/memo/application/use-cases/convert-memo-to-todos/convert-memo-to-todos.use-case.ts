import { ErrorCode } from "@aido/errors";
import type { DayOfWeek, Todo } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { toDateString } from "@/shared/domain/date/utils/format";
import { toLocalTimeString } from "@/shared/domain/date/utils/timezone";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import {
	MEMO_REPOSITORY,
	type MemoRepositoryPort,
} from "../../ports/memo.repository.port";
import {
	TODO_CREATOR,
	type TodoCreatorPort,
} from "../../ports/todo-creator.port";

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

/** 메모를 여러 할 일로 일괄 변환하는 입력 (변환 후 메모 삭제). */
export interface ConvertMemoToTodosInput {
	userId: string;
	memoId: number;
	data: ConvertMemoToTodosData;
	timezone: string;
}

/**
 * 메모 → 다중 할 일 일괄 변환 use-case.
 *
 * 반복 일정은 TodoCreatorPort.createRecurringTodos, 단건은 createTodo를 호출한다.
 *
 * **트랜잭션 설계 의도:** 각 todo 측 use-case가 자체 TX + 캐시 무효화 + 리마인더
 * 스케줄링(이벤트)을 포함하므로, 외부 TX로 감싸면 nested transaction + 부수효과
 * 복잡도가 크게 증가한다. 대신 메모 삭제를 마지막에 실행하여 중간 실패 시 메모가
 * 유지되어 재시도 가능하다(이미 생성된 Todo는 유지, 최대 5개라 부분 실패 확률 극소).
 */
@Injectable()
export class ConvertMemoToTodosUseCase {
	readonly #logger = new Logger(ConvertMemoToTodosUseCase.name);

	constructor(
		@Inject(MEMO_REPOSITORY)
		private readonly repository: MemoRepositoryPort,
		@Inject(TODO_CREATOR)
		private readonly todoCreator: TodoCreatorPort,
		private readonly cacheService: CacheService,
	) {}

	async execute(
		input: ConvertMemoToTodosInput,
	): Promise<ConvertMemoToTodosResult> {
		const { userId, memoId, data, timezone } = input;

		// 1. 소유권 확인 (읽기 전용, TX 외부)
		const memo = await this.repository.findByIdAndUserId(memoId, userId);
		if (!memo) {
			throw new ApplicationException(ErrorCode.MEMO_2001, { memoId });
		}

		// 2. 모든 Todo 생성 (각 todo 측 use-case가 자체 TX 관리)
		const todos: Todo[] = [];

		for (const todoData of data.todos) {
			if (todoData.isRecurring && todoData.recurrence) {
				const result = await this.todoCreator.createRecurringTodos(
					{
						userId,
						title: todoData.title,
						categoryId: todoData.categoryId,
						startDate: toDateString(todoData.startDate),
						endDate: toDateString(todoData.recurrence.endDate),
						daysOfWeek: todoData.recurrence.daysOfWeek,
						scheduledTime: todoData.scheduledTime
							? toLocalTimeString(todoData.scheduledTime, timezone)
							: null,
						isAllDay: todoData.isAllDay ?? true,
						visibility: todoData.visibility ?? "PUBLIC",
					},
					timezone,
				);
				todos.push(...result.todos);
			} else {
				const todo = await this.todoCreator.createTodo({
					userId,
					title: todoData.title,
					categoryId: todoData.categoryId,
					startDate: todoData.startDate,
					endDate: todoData.endDate,
					scheduledTime: todoData.scheduledTime,
					isAllDay: todoData.isAllDay ?? true,
					visibility: todoData.visibility ?? "PUBLIC",
					items: todoData.items,
				});
				todos.push(todo);
			}
		}

		// 3. 메모 삭제 (모든 Todo 생성 성공 후)
		await this.repository.delete(memoId);

		// 4. 캐시 무효화 (createRecurring은 내부에서 무효화하지 않음)
		await this.cacheService.invalidateTodoCategories(userId);

		this.#logger.log(
			`Memo ${memoId} converted to ${todos.length} todos for user: ${userId}`,
		);

		return {
			message: `메모가 ${todos.length}개의 할 일로 변환되었습니다.`,
			todos,
		};
	}
}
