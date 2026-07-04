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
import { UpdateTodoVisibilityCommand } from "./update-todo-visibility.command";

/**
 * Todo 공개 범위 변경 핸들러
 *
 * 소유권 확인 → 애그리게잇 전이 → 애그리게잇 상태로 영속화 → 읽기 포트로 응답 재조회.
 * 부수효과 없음(레거시 동작 보존).
 */
@CommandHandler(UpdateTodoVisibilityCommand)
export class UpdateTodoVisibilityHandler
	implements ICommandHandler<UpdateTodoVisibilityCommand>
{
	readonly #logger = new Logger(UpdateTodoVisibilityHandler.name);

	constructor(
		@Inject(TODO_REPOSITORY)
		private readonly todoRepository: TodoRepositoryPort,
		@Inject(TODO_READ_REPOSITORY)
		private readonly todoReadRepository: TodoReadRepositoryPort,
		@Inject(TRANSACTION_MANAGER)
		private readonly txManager: TransactionManagerPort,
	) {}

	async execute(command: UpdateTodoVisibilityCommand): Promise<TodoResponse> {
		const { id, userId, visibility } = command;

		// TX 안에서 로드 → 애그리게잇 전이 → 애그리게잇 상태로 영속화
		await this.txManager.run(async (tx) => {
			const todo = await this.todoRepository.findByIdAndUserId(id, userId, tx);
			if (!todo) {
				throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
			}

			todo.changeVisibility(visibility);
			await this.todoRepository.updateVisibility(
				id,
				todo.toPersistence().visibility,
				tx,
			);
		});

		this.#logger.log(
			`Todo visibility updated: ${id} -> ${visibility} for user: ${userId}`,
		);

		// 응답 재조회
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
