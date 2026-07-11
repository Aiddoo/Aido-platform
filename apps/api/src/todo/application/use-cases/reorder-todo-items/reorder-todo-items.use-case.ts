import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain";
import {
	TODO_REPOSITORY,
	type TodoRepositoryPort,
} from "../../ports/todo.repository.port";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";

/** 하위 항목 순서 일괄 변경 입력. */
export interface ReorderTodoItemsInput {
	todoId: number;
	userId: string;
	itemIds: number[];
}

/**
 * 하위 항목 순서 일괄 변경 use-case
 *
 * TX 안에서 소유권 확인 → 전체 항목 ID 집합 일치 검증(부분 전달 시 sortOrder 충돌 방지) →
 * 배열 인덱스를 새 sortOrder로 일괄 재정렬 → 읽기 포트로 부모 할 일 재조회.
 */
@Injectable()
export class ReorderTodoItemsUseCase {
	readonly #logger = new Logger(ReorderTodoItemsUseCase.name);

	constructor(
		@Inject(TODO_REPOSITORY)
		private readonly todoRepository: TodoRepositoryPort,
		@Inject(TODO_READ_REPOSITORY)
		private readonly todoReadRepository: TodoReadRepositoryPort,
		@Inject(UNIT_OF_WORK)
		private readonly uow: UnitOfWorkPort,
	) {}

	async execute(input: ReorderTodoItemsInput): Promise<TodoResponse> {
		const { todoId, userId, itemIds } = input;

		// 1. TX 안에서 소유권 확인 → 집합 검증 → 일괄 재정렬 (원자성)
		await this.uow.run(async () => {
			const todo = await this.todoRepository.findByIdAndUserId(todoId, userId);
			if (!todo) {
				throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
			}

			// 전체 항목 ID 집합 일치 검증은 애그리게잇 불변식 (부분 전달 방지)
			todo.validateItemsReorder(itemIds);

			await this.todoRepository.reorderItems(itemIds);
		});

		this.#logger.log(
			`Todo items reordered: todo=${todoId} for user: ${userId}`,
		);

		// 2. 부모 할 일 전체 재조회
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
