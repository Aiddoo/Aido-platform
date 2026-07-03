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
import { ReorderTodoItemsCommand } from "./reorder-todo-items.command";

/**
 * 하위 항목 순서 일괄 변경 핸들러
 *
 * TX 안에서 소유권 확인 → 전체 항목 ID 집합 일치 검증(부분 전달 시 sortOrder 충돌 방지) →
 * 배열 인덱스를 새 sortOrder로 일괄 재정렬 → 읽기 포트로 부모 할 일 재조회.
 */
@CommandHandler(ReorderTodoItemsCommand)
export class ReorderTodoItemsHandler
	implements ICommandHandler<ReorderTodoItemsCommand>
{
	readonly #logger = new Logger(ReorderTodoItemsHandler.name);

	constructor(
		@Inject(TODO_REPOSITORY)
		private readonly todoRepository: TodoRepositoryPort,
		@Inject(TODO_READ_REPOSITORY)
		private readonly todoReadRepository: TodoReadRepositoryPort,
		@Inject(TRANSACTION_MANAGER)
		private readonly txManager: TransactionManagerPort,
	) {}

	async execute(command: ReorderTodoItemsCommand): Promise<TodoResponse> {
		const { todoId, userId, itemIds } = command;

		// 1. TX 안에서 소유권 확인 → 집합 검증 → 일괄 재정렬 (원자성)
		await this.txManager.run(async (tx) => {
			const todo = await this.todoRepository.findByIdAndUserId(
				todoId,
				userId,
				tx,
			);
			if (!todo) {
				throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
			}

			// 전체 항목 ID 필수 검증 (부분 전달 시 sortOrder 충돌 방지)
			const todoItemIds = new Set(todo.getItemIds());
			if (itemIds.length !== todoItemIds.size) {
				throw new ApplicationException(ErrorCode.SYS_0002, {
					message: "모든 하위 항목 ID를 전달해야 합니다",
					expected: todoItemIds.size,
					received: itemIds.length,
				});
			}
			for (const id of itemIds) {
				if (!todoItemIds.has(id)) {
					throw new ApplicationException(ErrorCode.TODO_0822, { itemId: id });
				}
			}

			await this.todoRepository.reorderItems(itemIds, tx);
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
