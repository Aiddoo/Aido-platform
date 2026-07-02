import { ErrorCode } from "@aido/errors";
import { Inject, Logger } from "@nestjs/common";
import {
	CommandHandler,
	EventPublisher,
	type ICommandHandler,
} from "@nestjs/cqrs";
import { ApplicationException } from "@/common/domain";
import type { Todo } from "../../../domain/entities/todo.entity";
import {
	TODO_REPOSITORY,
	type TodoRepositoryPort,
} from "../../ports/todo.repository.port";
import { ToggleTodoCompleteCommand } from "./toggle-todo-complete.command";

/**
 * Todo 완료 상태 토글 핸들러
 *
 * 애그리게잇을 로드해 완료 상태를 전이하고 영속화한 뒤, TodoToggledEvent를 발행합니다.
 * 스트릭·리마인더·친구 완료·마일스톤 부수효과는 이벤트 핸들러가 커밋 후 처리합니다.
 */
@CommandHandler(ToggleTodoCompleteCommand)
export class ToggleTodoCompleteHandler
	implements ICommandHandler<ToggleTodoCompleteCommand, Todo>
{
	readonly #logger = new Logger(ToggleTodoCompleteHandler.name);

	constructor(
		@Inject(TODO_REPOSITORY)
		private readonly todoRepository: TodoRepositoryPort,
		private readonly eventPublisher: EventPublisher,
	) {}

	async execute(command: ToggleTodoCompleteCommand): Promise<Todo> {
		const { id, userId, completed, timezone } = command;

		const found = await this.todoRepository.findByIdAndUserId(id, userId);
		if (!found) {
			throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
		}

		const todo = this.eventPublisher.mergeObjectContext(found);
		todo.toggleComplete(completed, timezone);

		const snapshot = todo.getSnapshot();
		const updated = await this.todoRepository.update(id, {
			completed: snapshot.completed,
			completedAt: snapshot.completedAt,
		});

		this.#logger.log(
			`Todo completion toggled: ${id} -> ${completed} for user: ${userId}`,
		);

		// 저장 완료 후 이벤트 발행 (부수효과는 이벤트 핸들러가 처리)
		todo.commit();

		return updated;
	}
}
