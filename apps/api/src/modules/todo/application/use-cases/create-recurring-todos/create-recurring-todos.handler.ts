import { randomUUID } from "node:crypto";
import { ErrorCode } from "@aido/errors";
import { RECURRING_TODO_LIMITS, TODO_LIMITS } from "@aido/validators";
import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, EventBus, type ICommandHandler } from "@nestjs/cqrs";
import {
	TRANSACTION_MANAGER,
	type TransactionManagerPort,
} from "@/common/database";
import { parseDateOnly } from "@/common/date/utils/parse";
import { parseLocalDateTime } from "@/common/date/utils/timezone";
import { ApplicationException } from "@/common/domain";
import { expandRecurringDates } from "../../../domain/services/expand-recurring-dates";
import { TodoTitle } from "../../../domain/value-objects/todo-title.vo";
import {
	CATEGORY_OWNERSHIP,
	type CategoryOwnershipPort,
} from "../../ports/category-ownership.port";
import {
	type NewTodoData,
	TODO_REPOSITORY,
	type TodoRepositoryPort,
} from "../../ports/todo.repository.port";
import { TODO_CACHE, type TodoCachePort } from "../../ports/todo-cache.port";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";
import {
	CreateRecurringTodosCommand,
	type CreateRecurringTodosResult,
} from "./create-recurring-todos.command";

/**
 * 반복 Todo 일괄 생성 핸들러
 *
 * 날짜 확장(도메인 서비스) → 인스턴스 수 검증 → 카테고리 소유권 확인(TX 외부) →
 * TX 안에서 한도 체크·sortOrder 결정·일괄 생성 → 캐시 무효화 →
 * 인스턴스별 TodoCreatedEvent 발행(리마인더 스케줄링은 이벤트 핸들러) →
 * 읽기 포트로 그룹 재조회 후 반환.
 */
@CommandHandler(CreateRecurringTodosCommand)
export class CreateRecurringTodosHandler
	implements ICommandHandler<CreateRecurringTodosCommand>
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
		@Inject(TODO_CACHE)
		private readonly todoCache: TodoCachePort,
		private readonly eventBus: EventBus,
	) {}

	async execute(
		command: CreateRecurringTodosCommand,
	): Promise<CreateRecurringTodosResult> {
		const { data, timezone } = command;

		// 도메인 제목 불변식 검증 (Zod 경계와 동일 규칙 — 도메인 자기방어)
		TodoTitle.create(data.title);

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

		// 5. 캐시 무효화 (todoCount 변경 — 단건 create와 동일 규칙)
		await this.todoCache.invalidateTodoCategories(data.userId);

		// 6. 저장 완료 후 인스턴스별 이벤트 발행 (리마인더 스케줄링은 이벤트 핸들러)
		for (const todo of created) {
			todo.markCreated();
			this.eventBus.publishAll(todo.pullDomainEvents());
		}

		// 7. 그룹 재조회 (sortOrder asc — 생성 순서와 동일)
		const todos = await this.todoReadRepository.findManyByRecurrenceGroupId(
			data.userId,
			recurrenceGroupId,
		);

		return { todos, count: todoCount };
	}
}
