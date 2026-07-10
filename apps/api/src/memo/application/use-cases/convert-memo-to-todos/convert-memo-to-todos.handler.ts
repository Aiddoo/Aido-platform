import { ErrorCode } from "@aido/errors";
import type { Todo } from "@aido/validators";
import { Inject, Logger } from "@nestjs/common";
import { CommandBus, CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { toDateString } from "@/shared/domain/date/utils/format";
import { toLocalTimeString } from "@/shared/domain/date/utils/timezone";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { CreateRecurringTodosCommand, CreateTodoCommand } from "@/todo";
import {
	MEMO_REPOSITORY,
	type MemoRepositoryPort,
} from "../../ports/memo.repository.port";
import {
	ConvertMemoToTodosCommand,
	type ConvertMemoToTodosResult,
} from "./convert-memo-to-todos.command";

/**
 * 메모 → 다중 할 일 일괄 변환 핸들러.
 *
 * 반복 일정은 CreateRecurringTodosCommand, 단건은 CreateTodoCommand를 디스패치한다.
 *
 * **트랜잭션 설계 의도:** 각 커맨드 핸들러가 자체 TX + 캐시 무효화 + 리마인더
 * 스케줄링(이벤트)을 포함하므로, 외부 TX로 감싸면 nested transaction + 부수효과
 * 복잡도가 크게 증가한다. 대신 메모 삭제를 마지막에 실행하여 중간 실패 시 메모가
 * 유지되어 재시도 가능하다(이미 생성된 Todo는 유지, 최대 5개라 부분 실패 확률 극소).
 */
@CommandHandler(ConvertMemoToTodosCommand)
export class ConvertMemoToTodosHandler
	implements
		ICommandHandler<ConvertMemoToTodosCommand, ConvertMemoToTodosResult>
{
	readonly #logger = new Logger(ConvertMemoToTodosHandler.name);

	constructor(
		@Inject(MEMO_REPOSITORY)
		private readonly repository: MemoRepositoryPort,
		private readonly commandBus: CommandBus,
		private readonly cacheService: CacheService,
	) {}

	async execute(
		command: ConvertMemoToTodosCommand,
	): Promise<ConvertMemoToTodosResult> {
		const { userId, memoId, data, timezone } = command;

		// 1. 소유권 확인 (읽기 전용, TX 외부)
		const memo = await this.repository.findByIdAndUserId(memoId, userId);
		if (!memo) {
			throw new ApplicationException(ErrorCode.MEMO_2001, { memoId });
		}

		// 2. 모든 Todo 생성 (각 커맨드 핸들러가 자체 TX 관리)
		const todos: Todo[] = [];

		for (const todoData of data.todos) {
			if (todoData.isRecurring && todoData.recurrence) {
				const result = await this.commandBus.execute(
					new CreateRecurringTodosCommand(
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
					),
				);
				todos.push(...result.todos);
			} else {
				const todo = await this.commandBus.execute(
					new CreateTodoCommand({
						userId,
						title: todoData.title,
						categoryId: todoData.categoryId,
						startDate: todoData.startDate,
						endDate: todoData.endDate,
						scheduledTime: todoData.scheduledTime,
						isAllDay: todoData.isAllDay ?? true,
						visibility: todoData.visibility ?? "PUBLIC",
						items: todoData.items,
					}),
				);
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
