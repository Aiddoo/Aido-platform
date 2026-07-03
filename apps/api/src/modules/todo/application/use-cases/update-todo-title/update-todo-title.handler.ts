import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, EventBus, type ICommandHandler } from "@nestjs/cqrs";
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
 * 소유권 확인 → 애그리게잇 전이(TodoTitle 불변식 검증) → 애그리게잇 상태로 영속화 →
 * 이벤트 발행 → 읽기 포트로 응답 재조회.
 */
@CommandHandler(UpdateTodoTitleCommand)
export class UpdateTodoTitleHandler
	implements ICommandHandler<UpdateTodoTitleCommand>
{
	readonly #logger = new Logger(UpdateTodoTitleHandler.name);

	constructor(
		@Inject(TODO_REPOSITORY)
		private readonly todoRepository: TodoRepositoryPort,
		@Inject(TODO_READ_REPOSITORY)
		private readonly todoReadRepository: TodoReadRepositoryPort,
		private readonly eventBus: EventBus,
	) {}

	async execute(command: UpdateTodoTitleCommand): Promise<TodoResponse> {
		const { id, userId, title } = command;

		// 1. 소유권 확인
		const todo = await this.todoRepository.findByIdAndUserId(id, userId);
		if (!todo) {
			throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
		}

		// 2. 애그리게잇 전이(제목 불변식 검증) → 애그리게잇 상태로 영속화
		todo.updateDetails({ title });
		await this.todoRepository.updateTitle(id, todo.toPersistence().title);

		this.#logger.log(`Todo title updated: ${id} for user: ${userId}`);

		// 3. 저장 완료 후 이벤트 발행 (완료 필드 없음 → 부수효과 없음)
		this.eventBus.publishAll(todo.pullDomainEvents());

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
