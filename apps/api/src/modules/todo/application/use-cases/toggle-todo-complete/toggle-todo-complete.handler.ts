import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, EventBus, type ICommandHandler } from "@nestjs/cqrs";
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
	implements ICommandHandler<ToggleTodoCompleteCommand>
{
	readonly #logger = new Logger(ToggleTodoCompleteHandler.name);

	constructor(
		@Inject(TODO_REPOSITORY)
		private readonly todoRepository: TodoRepositoryPort,
		@Inject(TODO_READ_REPOSITORY)
		private readonly todoReadRepository: TodoReadRepositoryPort,
		@Inject(TRANSACTION_MANAGER)
		private readonly txManager: TransactionManagerPort,
		private readonly eventBus: EventBus,
	) {}

	async execute(command: ToggleTodoCompleteCommand): Promise<TodoResponse> {
		const { id, userId, completed, timezone } = command;

		// TX 안에서 로드 → 전이 → 영속화 (동시 수정 레이스 창 축소)
		const events = await this.txManager.run(async (tx) => {
			const todo = await this.todoRepository.findByIdAndUserId(id, userId, tx);
			if (!todo) {
				throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
			}

			// 같은 값 재토글이면 쓰기·이벤트 생략 (스트릭/알림 재발화 억제, 응답은 동일)
			const changed = todo.toggleComplete(completed, timezone);
			if (!changed) {
				return [];
			}

			await this.todoRepository.updateCompletion(
				id,
				todo.isCompleted(),
				todo.getCompletedAt(),
				tx,
			);

			this.#logger.log(
				`Todo completion toggled: ${id} -> ${completed} for user: ${userId}`,
			);
			return todo.pullDomainEvents();
		});

		// 저장(TX 커밋) 완료 후 이벤트 발행 (부수효과는 이벤트 핸들러가 처리)
		this.eventBus.publishAll(events);

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
