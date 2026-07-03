import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { TODO_LIMITS } from "@aido/validators";
import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, EventBus, type ICommandHandler } from "@nestjs/cqrs";
import {
	TRANSACTION_MANAGER,
	type TransactionManagerPort,
} from "@/common/database";
import { ApplicationException } from "@/common/domain";
import { TodoTitle } from "../../../domain/value-objects/todo-title.vo";
import {
	CATEGORY_OWNERSHIP,
	type CategoryOwnershipPort,
} from "../../ports/category-ownership.port";
import {
	TODO_REPOSITORY,
	type TodoRepositoryPort,
} from "../../ports/todo.repository.port";
import { TODO_CACHE, type TodoCachePort } from "../../ports/todo-cache.port";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";
import { CreateTodoCommand } from "./create-todo.command";

/**
 * Todo 생성 핸들러
 *
 * 카테고리 소유권 확인(TX 외부) → 트랜잭션 내 한도 체크·sortOrder 결정·생성·인라인 항목 →
 * 캐시 무효화 → TodoCreatedEvent 발행(리마인더 스케줄링은 이벤트 핸들러) →
 * 읽기 포트로 응답 read model 조회 후 반환.
 */
@CommandHandler(CreateTodoCommand)
export class CreateTodoHandler implements ICommandHandler<CreateTodoCommand> {
	readonly #logger = new Logger(CreateTodoHandler.name);

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

	async execute(command: CreateTodoCommand): Promise<TodoResponse> {
		const { data } = command;

		// 도메인 제목 불변식 검증 (Zod 경계와 동일 규칙 — 도메인 자기방어)
		TodoTitle.create(data.title);

		// 카테고리 존재 및 소유권 확인 (읽기 전용, TX 외부)
		await this.categoryOwnership.validateOwnership(
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
					userId: data.userId,
					categoryId: data.categoryId,
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

			if (data.items?.length) {
				await this.todoRepository.createInlineItems(
					todo.getId().getValue(),
					data.items,
					tx,
				);
			}

			return todo;
		});

		this.#logger.log(
			`Todo created: ${created.getId().getValue()} for user: ${data.userId}`,
		);

		await this.todoCache.invalidateTodoCategories(data.userId);

		// 생성 이벤트 발행(TX 커밋 후) → 리마인더 스케줄링은 이벤트 핸들러가 처리
		created.markCreated();
		this.eventBus.publishAll(created.pullDomainEvents());

		// 응답 read model 조회 (카테고리·itemStats 포함)
		const response = await this.todoReadRepository.findByIdAndUserId(
			created.getId().getValue(),
			data.userId,
		);
		if (!response) {
			throw new ApplicationException(ErrorCode.TODO_0801, {
				todoId: created.getId().getValue(),
			});
		}
		return response;
	}
}
