import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { Inject, Logger } from "@nestjs/common";
import {
	CommandHandler,
	EventPublisher,
	type ICommandHandler,
} from "@nestjs/cqrs";
import { ApplicationException } from "@/common/domain";
import {
	CATEGORY_OWNERSHIP,
	type CategoryOwnershipPort,
} from "../../ports/category-ownership.port";
import {
	TODO_REPOSITORY,
	type TodoRepositoryPort,
	type TodoUpdatePatch,
} from "../../ports/todo.repository.port";
import { TODO_CACHE, type TodoCachePort } from "../../ports/todo-cache.port";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";
import { UpdateTodoCommand } from "./update-todo.command";

/**
 * Todo 부분 수정 핸들러
 *
 * 소유권 확인 → (카테고리 변경 시) 대상 카테고리 소유권 확인 → 애그리게잇 전이·패치 영속화 →
 * (카테고리 변경 시) 캐시 무효화 → TodoUpdatedEvent 발행(완료 요청이면 리마인더 취소) →
 * 읽기 포트로 응답 재조회.
 *
 * 주의(레거시 동작 보존): 카테고리 변경 시 활성 한도(MAX_PER_CATEGORY)를 재체크하지
 * 않습니다 — 한도 체크는 PATCH /todos/:id/category 전용입니다. 통일 여부는 별도 티켓.
 */
@CommandHandler(UpdateTodoCommand)
export class UpdateTodoHandler
	implements ICommandHandler<UpdateTodoCommand, TodoResponse>
{
	readonly #logger = new Logger(UpdateTodoHandler.name);

	constructor(
		@Inject(TODO_REPOSITORY)
		private readonly todoRepository: TodoRepositoryPort,
		@Inject(TODO_READ_REPOSITORY)
		private readonly todoReadRepository: TodoReadRepositoryPort,
		@Inject(CATEGORY_OWNERSHIP)
		private readonly categoryOwnership: CategoryOwnershipPort,
		@Inject(TODO_CACHE)
		private readonly todoCache: TodoCachePort,
		private readonly eventPublisher: EventPublisher,
	) {}

	async execute(command: UpdateTodoCommand): Promise<TodoResponse> {
		const { id, userId, data } = command;

		// 1. 소유권 확인
		const found = await this.todoRepository.findByIdAndUserId(id, userId);
		if (!found) {
			throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
		}

		// 2. 카테고리 변경 시 대상 카테고리 소유권 확인 (읽기 전용, TX 외부)
		if (data.categoryId !== undefined) {
			await this.categoryOwnership.validateOwnership(data.categoryId, userId);
		}

		// 3. 애그리게잇 전이 + 패치 영속화 (완료 전이 시에만 completedAt 파생)
		const wasCompleted = found.isCompleted();
		const todo = this.eventPublisher.mergeObjectContext(found);
		todo.updateDetails(data);

		const patch: TodoUpdatePatch = { ...data };
		if (data.completed !== undefined && data.completed !== wasCompleted) {
			patch.completedAt = todo.getCompletedAt();
		}
		await this.todoRepository.updateDetails(id, patch);

		this.#logger.log(`Todo updated: ${id} for user: ${userId}`);

		// 4. 카테고리 변경 시 캐시 무효화
		if (data.categoryId !== undefined) {
			await this.todoCache.invalidateTodoCategories(userId);
		}

		// 5. 저장 완료 후 이벤트 발행 (완료 요청이면 이벤트 핸들러가 리마인더 취소)
		todo.commit();

		// 6. 응답 재조회
		const response = await this.todoReadRepository.findByIdAndUserId(
			id,
			userId,
		);
		if (!response) {
			throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
		}
		return response;
	}
}
