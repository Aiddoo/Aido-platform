import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { TODO_ITEM_LIMITS } from "@aido/validators";
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
import { AddTodoItemCommand } from "./add-todo-item.command";

/**
 * 하위 항목 추가 핸들러
 *
 * 소유권 확인(TX 외부) → TX 안에서 항목 한도 체크·sortOrder 결정·생성(race 방지) →
 * 읽기 포트로 부모 할 일 전체를 재조회해 반환.
 */
@CommandHandler(AddTodoItemCommand)
export class AddTodoItemHandler implements ICommandHandler<AddTodoItemCommand> {
	readonly #logger = new Logger(AddTodoItemHandler.name);

	constructor(
		@Inject(TODO_REPOSITORY)
		private readonly todoRepository: TodoRepositoryPort,
		@Inject(TODO_READ_REPOSITORY)
		private readonly todoReadRepository: TodoReadRepositoryPort,
		@Inject(TRANSACTION_MANAGER)
		private readonly txManager: TransactionManagerPort,
	) {}

	async execute(command: AddTodoItemCommand): Promise<TodoResponse> {
		const { todoId, userId, title } = command;

		// 1. 소유권 확인 (읽기 전용, TX 외부)
		const todo = await this.todoRepository.findByIdAndUserId(todoId, userId);
		if (!todo) {
			throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
		}

		// 2. TX 안에서 한도 체크 + sortOrder 결정 + 생성 (race condition 방지)
		await this.txManager.run(async (tx) => {
			const itemCount = await this.todoRepository.countItemsByTodoId(
				todoId,
				tx,
			);
			if (itemCount >= TODO_ITEM_LIMITS.MAX_PER_TODO) {
				throw new ApplicationException(ErrorCode.TODO_0821, {
					currentCount: itemCount,
					maxPerTodo: TODO_ITEM_LIMITS.MAX_PER_TODO,
				});
			}

			const maxSortOrder = await this.todoRepository.getMaxItemSortOrder(
				todoId,
				tx,
			);
			await this.todoRepository.createItem(
				todoId,
				{ title, sortOrder: maxSortOrder + 1 },
				tx,
			);
		});

		this.#logger.log(`Todo item added: todo=${todoId} for user: ${userId}`);

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
