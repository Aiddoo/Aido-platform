import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { TODO_LIMITS } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import {
	DOMAIN_EVENT_PUBLISHER,
	type DomainEventPublisherPort,
	UNIT_OF_WORK,
	type UnitOfWorkPort,
} from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain";
import { Todo } from "../../../domain/entities/todo.entity";
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
import type { CreateTodoData } from "../../types";

/** Todo 생성 입력. */
export type CreateTodoInput = CreateTodoData;

/**
 * Todo 생성 use-case
 *
 * 카테고리 소유권 확인(TX 외부) → 트랜잭션 내 한도 체크·sortOrder 결정·생성·인라인 항목 →
 * 캐시 무효화 → TodoCreatedEvent 발행(리마인더 스케줄링은 이벤트 핸들러) →
 * 읽기 포트로 응답 read model 조회 후 반환.
 */
@Injectable()
export class CreateTodoUseCase {
	readonly #logger = new Logger(CreateTodoUseCase.name);

	constructor(
		@Inject(TODO_REPOSITORY)
		private readonly todoRepository: TodoRepositoryPort,
		@Inject(TODO_READ_REPOSITORY)
		private readonly todoReadRepository: TodoReadRepositoryPort,
		@Inject(UNIT_OF_WORK)
		private readonly uow: UnitOfWorkPort,
		@Inject(CATEGORY_OWNERSHIP)
		private readonly categoryOwnership: CategoryOwnershipPort,
		@Inject(TODO_CACHE)
		private readonly todoCache: TodoCachePort,
		@Inject(DOMAIN_EVENT_PUBLISHER)
		private readonly eventPublisher: DomainEventPublisherPort,
	) {}

	async execute(input: CreateTodoInput): Promise<TodoResponse> {
		const data = input;

		// 생성 초안 — 생성 불변식(제목)·기본값 파생의 단일 지점 (도메인 팩토리)
		const draft = Todo.planCreation({
			userId: data.userId,
			categoryId: data.categoryId,
			title: data.title,
			startDate: data.startDate,
			endDate: data.endDate,
			scheduledTime: data.scheduledTime,
			isAllDay: data.isAllDay,
			visibility: data.visibility,
		});

		// 카테고리 존재 및 소유권 확인 (읽기 전용, TX 외부)
		await this.categoryOwnership.validateOwnership(
			data.categoryId,
			data.userId,
		);

		// TX 내에서 제한 체크 + sortOrder 결정 + 생성 (race condition 방지)
		const created = await this.uow.run(async () => {
			const activeInCategory = await this.todoRepository.countActiveByCategory(
				data.userId,
				data.categoryId,
			);
			if (activeInCategory >= TODO_LIMITS.MAX_PER_CATEGORY) {
				throw new ApplicationException(ErrorCode.TODO_0811, {
					activeCount: activeInCategory,
					maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY,
				});
			}

			const maxSortOrder = await this.todoRepository.getMaxSortOrder(
				data.userId,
			);

			const todo = await this.todoRepository.create({
				...draft,
				sortOrder: maxSortOrder + 1,
			});

			if (data.items?.length) {
				await this.todoRepository.createInlineItems(
					todo.getId().getValue(),
					data.items,
				);
			}

			return todo;
		});

		this.#logger.log(
			`Todo created: ${created.getId().getValue()} for user: ${data.userId}`,
		);

		await this.todoCache.invalidateTodoCategories(data.userId);
		await this.todoCache.invalidateFriendTodos(data.userId);

		// 생성 이벤트 발행(TX 커밋 후) → 리마인더 스케줄링은 이벤트 핸들러가 처리
		created.markCreated();
		this.eventPublisher.publishAll(created.pullDomainEvents());

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
