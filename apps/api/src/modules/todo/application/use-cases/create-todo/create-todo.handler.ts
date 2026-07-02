import { ErrorCode } from "@aido/errors";
import { TODO_LIMITS } from "@aido/validators";
import { Inject, Logger } from "@nestjs/common";
import {
	CommandHandler,
	EventPublisher,
	type ICommandHandler,
} from "@nestjs/cqrs";
import { CacheService } from "@/common/cache/cache.service";
import {
	TRANSACTION_MANAGER,
	type TransactionManagerPort,
} from "@/common/database";
import { ApplicationException } from "@/common/domain";
import { TodoCategoryService } from "../../../../todo-category/todo-category.service";
import type { Todo } from "../../../domain/entities/todo.entity";
import {
	TODO_REPOSITORY,
	type TodoRepositoryPort,
} from "../../ports/todo.repository.port";
import { CreateTodoCommand } from "./create-todo.command";

/**
 * Todo 생성 핸들러
 *
 * 카테고리 소유권 확인(TX 외부) → 트랜잭션 내 한도 체크·sortOrder 결정·생성·인라인 항목 →
 * 캐시 무효화 → TodoCreatedEvent 발행(리마인더 스케줄링은 이벤트 핸들러가 처리).
 */
@CommandHandler(CreateTodoCommand)
export class CreateTodoHandler
	implements ICommandHandler<CreateTodoCommand, Todo>
{
	readonly #logger = new Logger(CreateTodoHandler.name);

	constructor(
		@Inject(TODO_REPOSITORY)
		private readonly todoRepository: TodoRepositoryPort,
		@Inject(TRANSACTION_MANAGER)
		private readonly txManager: TransactionManagerPort,
		private readonly todoCategoryService: TodoCategoryService,
		private readonly cacheService: CacheService,
		private readonly eventPublisher: EventPublisher,
	) {}

	async execute(command: CreateTodoCommand): Promise<Todo> {
		const { data } = command;

		// 카테고리 존재 및 소유권 확인 (읽기 전용, TX 외부)
		await this.todoCategoryService.validateOwnership(
			data.categoryId,
			data.userId,
		);

		// TX 내에서 제한 체크 + sortOrder 결정 + 생성 (race condition 방지)
		const created = await this.txManager.run(async (tx) => {
			const activeInCategory = await this.todoRepository.countActiveByCategory(
				data.userId,
				data.categoryId,
				tx,
			);
			if (activeInCategory >= TODO_LIMITS.MAX_PER_CATEGORY) {
				throw new ApplicationException(ErrorCode.TODO_0811, {
					activeCount: activeInCategory,
					maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY,
				});
			}

			const maxSortOrder = await this.todoRepository.getMaxSortOrder(
				data.userId,
				tx,
			);

			const todo = await this.todoRepository.create(
				{
					user: { connect: { id: data.userId } },
					category: { connect: { id: data.categoryId } },
					title: data.title,
					sortOrder: maxSortOrder + 1,
					startDate: data.startDate,
					endDate: data.endDate,
					scheduledTime: data.scheduledTime,
					isAllDay: data.isAllDay ?? true,
					visibility: data.visibility ?? "PUBLIC",
				},
				tx,
			);

			// 인라인 하위 항목 생성 후 재조회 (items 포함)
			if (data.items?.length) {
				await this.todoRepository.createInlineItems(
					todo.getId(),
					data.items,
					tx,
				);
				const refetched = await this.todoRepository.findByIdAndUserId(
					todo.getId(),
					data.userId,
					tx,
				);
				if (!refetched) {
					throw new ApplicationException(ErrorCode.TODO_0801, {
						todoId: todo.getId(),
					});
				}
				return refetched;
			}

			return todo;
		});

		this.#logger.log(
			`Todo created: ${created.getId()} for user: ${data.userId}`,
		);

		await this.cacheService.invalidateTodoCategories(data.userId);

		// 생성 이벤트 발행 → 리마인더 스케줄링은 이벤트 핸들러가 처리
		const todo = this.eventPublisher.mergeObjectContext(created);
		todo.markCreated();
		todo.commit();

		return todo;
	}
}
