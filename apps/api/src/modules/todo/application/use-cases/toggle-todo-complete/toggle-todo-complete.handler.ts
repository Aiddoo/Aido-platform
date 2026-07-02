import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { Inject, Logger } from "@nestjs/common";
import {
	CommandHandler,
	EventPublisher,
	type ICommandHandler,
} from "@nestjs/cqrs";
import { ApplicationException } from "@/common/domain";
import {
	TODO_REPOSITORY,
	type TodoRepositoryPort,
} from "../../ports/todo.repository.port";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";
import { ToggleTodoCompleteCommand } from "./toggle-todo-complete.command";

/**
 * Todo 완료 상태 토글 핸들러
 *
 * 애그리게잇을 로드해 완료 상태를 전이·영속화한 뒤 TodoToggledEvent를 발행하고,
 * 읽기 포트로 응답 read model을 조회해 반환합니다.
 * 스트릭·리마인더·친구 완료·마일스톤 부수효과는 이벤트 핸들러가 커밋 후 처리합니다.
 */
@CommandHandler(ToggleTodoCompleteCommand)
export class ToggleTodoCompleteHandler
	implements ICommandHandler<ToggleTodoCompleteCommand, TodoResponse>
{
	readonly #logger = new Logger(ToggleTodoCompleteHandler.name);

	constructor(
		@Inject(TODO_REPOSITORY)
		private readonly todoRepository: TodoRepositoryPort,
		@Inject(TODO_READ_REPOSITORY)
		private readonly todoReadRepository: TodoReadRepositoryPort,
		private readonly eventPublisher: EventPublisher,
	) {}

	async execute(command: ToggleTodoCompleteCommand): Promise<TodoResponse> {
		const { id, userId, completed, timezone } = command;

		const found = await this.todoRepository.findByIdAndUserId(id, userId);
		if (!found) {
			throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
		}

		const todo = this.eventPublisher.mergeObjectContext(found);
		todo.toggleComplete(completed, timezone);

		await this.todoRepository.updateCompletion(
			id,
			todo.isCompleted(),
			todo.getCompletedAt(),
		);

		this.#logger.log(
			`Todo completion toggled: ${id} -> ${completed} for user: ${userId}`,
		);

		// 저장 완료 후 이벤트 발행 (부수효과는 이벤트 핸들러가 처리)
		todo.commit();

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
