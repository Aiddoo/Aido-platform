import { randomUUID } from "node:crypto";
import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { RECURRING_TODO_LIMITS, TODO_LIMITS } from "@aido/validators";
import { Inject, Logger } from "@nestjs/common";
import {
	CommandHandler,
	EventPublisher,
	type ICommandHandler,
} from "@nestjs/cqrs";
import {
	TRANSACTION_MANAGER,
	type TransactionManagerPort,
} from "@/common/database";
import { parseDateOnly } from "@/common/date/utils/parse";
import { parseLocalDateTime } from "@/common/date/utils/timezone";
import { ApplicationException } from "@/common/domain";
import { expandRecurringDates } from "../../../domain/services/expand-recurring-dates";
import {
	CATEGORY_OWNERSHIP,
	type CategoryOwnershipPort,
} from "../../ports/category-ownership.port";
import {
	type NewTodoData,
	TODO_REPOSITORY,
	type TodoRepositoryPort,
} from "../../ports/todo.repository.port";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";
import { CreateRecurringTodosCommand } from "./create-recurring-todos.command";

/** 반복 생성 결과 read model */
export interface CreateRecurringTodosResult {
	todos: TodoResponse[];
	count: number;
}

/**
 * 반복 Todo 일괄 생성 핸들러
 *
 * 날짜 확장(도메인 서비스) → 인스턴스 수 검증 → 카테고리 소유권 확인(TX 외부) →
 * TX 안에서 한도 체크·sortOrder 결정·일괄 생성 → 인스턴스별 TodoCreatedEvent 발행
 * (리마인더 스케줄링은 이벤트 핸들러) → 읽기 포트로 그룹 재조회 후 반환.
 *
 * 주의(레거시 동작 보존): 단건 create와 달리 카테고리 캐시를 무효화하지 않습니다.
 * TODO(후속 티켓): createRecurring에도 invalidateTodoCategories 추가 여부 결정.
 */
@CommandHandler(CreateRecurringTodosCommand)
export class CreateRecurringTodosHandler
	implements
		ICommandHandler<CreateRecurringTodosCommand, CreateRecurringTodosResult>
{
	readonly #logger = new Logger(CreateRecurringTodosHandler.name);

	constructor(
		@Inject(TODO_REPOSITORY)
		private readonly todoRepository: TodoRepositoryPort,
		@Inject(TODO_READ_REPOSITORY)
		private readonly todoReadRepository: TodoReadRepositoryPort,
		@Inject(TRANSACTION_MANAGER)
		private readonly txManager: TransactionManagerPort,
		@Inject(CATEGORY_OWNERSHIP)
		private readonly categoryOwnership: CategoryOwnershipPort,
		private readonly eventPublisher: EventPublisher,
	) {}

	async execute(
		command: CreateRecurringTodosCommand,
	): Promise<CreateRecurringTodosResult> {
		const { data, timezone } = command;

		// 1. 날짜 확장 (요일 매칭, 도메인 서비스)
		const matchingDates = expandRecurringDates(
			data.startDate,
			data.endDate,
			data.daysOfWeek,
		);
		const todoCount = matchingDates.length;

		// 2. 인스턴스 수 검증
		if (todoCount === 0) {
			throw new ApplicationException(ErrorCode.SYS_0002, {
				message: "선택한 기간과 요일에 해당하는 날짜가 없습니다",
				startDate: data.startDate,
				endDate: data.endDate,
				daysOfWeek: data.daysOfWeek,
			});
		}
		if (todoCount > RECURRING_TODO_LIMITS.MAX_INSTANCES) {
			throw new ApplicationException(ErrorCode.TODO_0812, {
				count: todoCount,
				limit: RECURRING_TODO_LIMITS.MAX_INSTANCES,
			});
		}

		// 3. 카테고리 소유권 확인 (읽기 전용, TX 외부)
		await this.categoryOwnership.validateOwnership(
			data.categoryId,
			data.userId,
		);

		// 4. TX 안에서 한도 체크 + sortOrder 결정 + 일괄 생성 (race condition 방지)
		const recurrenceGroupId = randomUUID();

		const created = await this.txManager.run(async (tx) => {
			const activeInCategory = await this.todoRepository.countActiveByCategory(
				data.userId,
				data.categoryId,
				tx,
			);
			if (activeInCategory + todoCount > TODO_LIMITS.MAX_PER_CATEGORY) {
				throw new ApplicationException(ErrorCode.TODO_0813, {
					activeInCategory,
					batchSize: todoCount,
					maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY,
				});
			}

			const maxSortOrder = await this.todoRepository.getMaxSortOrder(
				data.userId,
				tx,
			);

			const items: NewTodoData[] = matchingDates.map((dateStr, index) => ({
				userId: data.userId,
				categoryId: data.categoryId,
				title: data.title,
				sortOrder: maxSortOrder + 1 + index,
				startDate: parseDateOnly(dateStr),
				scheduledTime: data.scheduledTime
					? parseLocalDateTime(dateStr, data.scheduledTime, timezone)
					: null,
				isAllDay: data.isAllDay ?? true,
				visibility: data.visibility ?? "PUBLIC",
			}));

			return this.todoRepository.createMany(items, recurrenceGroupId, tx);
		});

		this.#logger.log(
			`Recurring todos created: ${todoCount} items, group: ${recurrenceGroupId}, user: ${data.userId}`,
		);

		// 5. 저장 완료 후 인스턴스별 이벤트 발행 (리마인더 스케줄링은 이벤트 핸들러)
		for (const aggregate of created) {
			const todo = this.eventPublisher.mergeObjectContext(aggregate);
			todo.markCreated();
			todo.commit();
		}

		// 6. 그룹 재조회 (sortOrder asc — 생성 순서와 동일)
		const todos = await this.todoReadRepository.findManyByRecurrenceGroupId(
			data.userId,
			recurrenceGroupId,
		);

		return { todos, count: todoCount };
	}
}
