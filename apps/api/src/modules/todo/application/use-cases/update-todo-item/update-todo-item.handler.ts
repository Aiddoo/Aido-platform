import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import {
	TRANSACTION_MANAGER,
	type TransactionManagerPort,
} from "@/common/database";
import { ApplicationException } from "@/common/domain";
import {
	TODO_REPOSITORY,
	type TodoRepositoryPort,
} from "../../ports/todo.repository.port";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";
import { UpdateTodoItemCommand } from "./update-todo-item.command";

/**
 * 하위 항목 수정 핸들러 (제목/완료 토글)
 *
 * TX 안에서 소유권·항목 존재 확인 후 수정 → 읽기 포트로 부모 할 일 재조회.
 * 하위 항목 완료는 부모 완료·스트릭·리마인더에 영향을 주지 않습니다(레거시 동작 보존).
 */
@CommandHandler(UpdateTodoItemCommand)
export class UpdateTodoItemHandler
	implements ICommandHandler<UpdateTodoItemCommand, TodoResponse>
{
	readonly #logger = new Logger(UpdateTodoItemHandler.name);

	constructor(
		@Inject(TODO_REPOSITORY)
		private readonly todoRepository: TodoRepositoryPort,
		@Inject(TODO_READ_REPOSITORY)
		private readonly todoReadRepository: TodoReadRepositoryPort,
		@Inject(TRANSACTION_MANAGER)
		private readonly txManager: TransactionManagerPort,
	) {}

	async execute(command: UpdateTodoItemCommand): Promise<TodoResponse> {
		const { todoId, itemId, userId, data } = command;

		// 1. TX 안에서 소유권·항목 존재 확인 후 수정 (원자성)
		await this.txManager.run(async (tx) => {
			const todo = await this.todoRepository.findByIdAndUserId(
				todoId,
				userId,
				tx,
			);
			if (!todo) {
				throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
			}
			if (!todo.hasItem(itemId)) {
				throw new ApplicationException(ErrorCode.TODO_0822, { itemId });
			}

			await this.todoRepository.updateItem(itemId, data, tx);
		});

		this.#logger.log(
			`Todo item updated: todo=${todoId}, item=${itemId} for user: ${userId}`,
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
