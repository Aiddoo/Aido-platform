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

/** 하위 항목 삭제 입력. */
export interface DeleteTodoItemInput {
	todoId: number;
	itemId: number;
	userId: string;
}

/**
 * 하위 항목 삭제 use-case
 *
 * TX 안에서 소유권·항목 존재 확인 후 삭제 → 읽기 포트로 부모 할 일 재조회
 * (itemStats 재계산 반영).
 */
@Injectable()
export class DeleteTodoItemUseCase {
	readonly #logger = new Logger(DeleteTodoItemUseCase.name);

	constructor(
		@Inject(TODO_REPOSITORY)
		private readonly todoRepository: TodoRepositoryPort,
		@Inject(TODO_READ_REPOSITORY)
		private readonly todoReadRepository: TodoReadRepositoryPort,
		@Inject(UNIT_OF_WORK)
		private readonly uow: UnitOfWorkPort,
	) {}

	async execute(input: DeleteTodoItemInput): Promise<TodoResponse> {
		const { todoId, itemId, userId } = input;

		// 1. TX 안에서 소유권·항목 존재 확인 후 삭제 (원자성)
		await this.uow.run(async () => {
			const todo = await this.todoRepository.findByIdAndUserId(todoId, userId);
			if (!todo) {
				throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
			}
			// 애그리게잇이 존재를 검증하고 자식 엔티티를 제거
			todo.removeItem(itemId);

			await this.todoRepository.deleteItem(itemId);
		});

		this.#logger.log(
			`Todo item deleted: todo=${todoId}, item=${itemId} for user: ${userId}`,
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
