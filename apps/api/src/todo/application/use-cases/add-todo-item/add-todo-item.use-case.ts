import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain";
import {
	TODO_REPOSITORY,
	type TodoRepositoryPort,
} from "../../ports/todo.repository.port";
import { TODO_CACHE, type TodoCachePort } from "../../ports/todo-cache.port";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";

/** 하위 항목 추가 입력. */
export interface AddTodoItemInput {
	todoId: number;
	userId: string;
	title: string;
}

/**
 * 하위 항목 추가 use-case
 *
 * TX 안에서 애그리게잇 로드 → 애그리게잇이 항목 한도·제목 불변식 검증 및
 * sortOrder 계획(planItemAddition) → 계획 영속화 → 읽기 포트로 재조회.
 * 동시 추가 레이스 특성은 기존 in-TX count 방식과 동등합니다(read committed).
 */
@Injectable()
export class AddTodoItemUseCase {
	readonly #logger = new Logger(AddTodoItemUseCase.name);

	constructor(
		@Inject(TODO_REPOSITORY)
		private readonly todoRepository: TodoRepositoryPort,
		@Inject(TODO_READ_REPOSITORY)
		private readonly todoReadRepository: TodoReadRepositoryPort,
		@Inject(UNIT_OF_WORK)
		private readonly uow: UnitOfWorkPort,
		@Inject(TODO_CACHE)
		private readonly todoCache: TodoCachePort,
	) {}

	async execute(input: AddTodoItemInput): Promise<TodoResponse> {
		const { todoId, userId, title } = input;

		// TX 안에서 애그리게잇 로드 → 불변식 검증·계획(도메인) → 영속화
		await this.uow.run(async () => {
			const todo = await this.todoRepository.findByIdAndUserId(todoId, userId);
			if (!todo) {
				throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
			}

			const plan = todo.planItemAddition(title);
			await this.todoRepository.createItem(todoId, plan);
		});

		this.#logger.log(`Todo item added: todo=${todoId} for user: ${userId}`);

		// 친구 공개 투두 캐시 무효화 (TX 커밋 후)
		await this.todoCache.invalidateFriendTodos(userId);

		// 3. 부모 할 일 전체 재조회 (items·itemStats 포함)
		const response = await this.todoReadRepository.findByIdAndUserId(
			todoId,
			userId,
		);
		if (!response) {
			throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
		}
		return response;
	}
}
