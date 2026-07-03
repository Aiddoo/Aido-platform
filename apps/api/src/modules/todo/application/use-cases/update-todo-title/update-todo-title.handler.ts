import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { ApplicationException } from "@/common/domain";
import {
	TODO_REPOSITORY,
	type TodoRepositoryPort,
} from "../../ports/todo.repository.port";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";
import { UpdateTodoTitleCommand } from "./update-todo-title.command";

/**
 * Todo 제목 수정 핸들러
 *
 * 소유권 확인 → 제목 영속화 → 읽기 포트로 응답 재조회.
 * 부수효과 없음(리마인더·캐시·이벤트 미발생 — 레거시 동작 보존).
 */
@CommandHandler(UpdateTodoTitleCommand)
export class UpdateTodoTitleHandler
	implements ICommandHandler<UpdateTodoTitleCommand, TodoResponse>
{
	readonly #logger = new Logger(UpdateTodoTitleHandler.name);

	constructor(
		@Inject(TODO_REPOSITORY)
		private readonly todoRepository: TodoRepositoryPort,
		@Inject(TODO_READ_REPOSITORY)
		private readonly todoReadRepository: TodoReadRepositoryPort,
	) {}

	async execute(command: UpdateTodoTitleCommand): Promise<TodoResponse> {
		const { id, userId, title } = command;

		// 1. 소유권 확인
		const found = await this.todoRepository.findByIdAndUserId(id, userId);
		if (!found) {
			throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
		}

		// 2. 제목 영속화
		await this.todoRepository.updateTitle(id, title);

		this.#logger.log(`Todo title updated: ${id} for user: ${userId}`);

		// 3. 응답 재조회
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
