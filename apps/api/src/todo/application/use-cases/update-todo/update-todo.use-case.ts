import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import {
	DOMAIN_EVENT_PUBLISHER,
	type DomainEventPublisherPort,
	UNIT_OF_WORK,
	type UnitOfWorkPort,
} from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain";
import type { TodoPersistenceSnapshot } from "../../../domain/entities/todo.aggregate";
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
import type { UpdateTodoData } from "../../types";

/** Todo 부분 수정 입력. */
export interface UpdateTodoInput {
	id: number;
	userId: string;
	data: UpdateTodoData;
}

/**
 * Todo 부분 수정 use-case
 *
 * 소유권 확인 → (카테고리 변경 시) 대상 카테고리 소유권 확인 → 애그리게잇 전이·패치 영속화 →
 * (카테고리 변경 시) 캐시 무효화 → TodoUpdatedEvent 발행(완료 요청이면 리마인더 취소) →
 * 읽기 포트로 응답 재조회.
 *
 * 주의(레거시 동작 보존): 카테고리 변경 시 활성 한도(MAX_PER_CATEGORY)를 재체크하지
 * 않습니다 — 한도 체크는 PATCH /todos/:id/category 전용입니다. 통일 여부는 별도 티켓.
 */
@Injectable()
export class UpdateTodoUseCase {
	readonly #logger = new Logger(UpdateTodoUseCase.name);

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

	async execute(input: UpdateTodoInput): Promise<TodoResponse> {
		const { id, userId, data } = input;

		// 1. 카테고리 변경 시 대상 카테고리 소유권 확인 (읽기 전용, TX 외부)
		if (data.categoryId !== undefined) {
			await this.categoryOwnership.validateOwnership(data.categoryId, userId);
		}

		// 2. TX 안에서 로드 → 애그리게잇 전이 → 애그리게잇 상태를 단일 소스로 영속화
		//    (load-mutate-write를 한 트랜잭션으로 묶어 동시 수정 레이스 창 축소)
		const events = await this.uow.run(async () => {
			const todo = await this.todoRepository.findByIdAndUserId(id, userId);
			if (!todo) {
				throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
			}

			const wasCompleted = todo.isCompleted();
			todo.updateDetails(data);
			const snapshot = todo.toPersistence();

			// 요청에 포함된 필드만 쓰되, 값은 커맨드가 아닌 애그리게잇에서 가져옴
			const patch: TodoUpdatePatch = {};
			const copyField = <
				K extends keyof UpdateTodoData &
					keyof TodoPersistenceSnapshot &
					keyof TodoUpdatePatch,
			>(
				key: K,
			): void => {
				if (data[key] !== undefined) {
					patch[key] = snapshot[key];
				}
			};
			copyField("title");
			copyField("categoryId");
			copyField("startDate");
			copyField("endDate");
			copyField("scheduledTime");
			copyField("isAllDay");
			copyField("visibility");
			if (data.completed !== undefined) {
				patch.completed = snapshot.completed;
				if (snapshot.completed !== wasCompleted) {
					patch.completedAt = snapshot.completedAt;
				}
			}
			await this.todoRepository.updateDetails(id, patch);

			return todo.pullDomainEvents();
		});

		this.#logger.log(`Todo updated: ${id} for user: ${userId}`);

		// 3. 카테고리 변경 시 캐시 무효화 + 친구 공개 투두 캐시는 항상 무효화
		if (data.categoryId !== undefined) {
			await this.todoCache.invalidateTodoCategories(userId);
		}
		await this.todoCache.invalidateFriendTodos(userId);

		// 저장(TX 커밋) 완료 후 이벤트 발행 (완료 상태면 이벤트 핸들러가 리마인더 취소)
		await this.eventPublisher.publishAll(events);

		// 4. 응답 재조회
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
