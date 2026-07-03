import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { Inject, Logger } from "@nestjs/common";
import {
	CommandHandler,
	EventPublisher,
	type ICommandHandler,
} from "@nestjs/cqrs";
import { ApplicationException } from "@/common/domain";
import { TodoSchedule } from "../../../domain/value-objects/todo-schedule.vo";
import {
	TODO_REPOSITORY,
	type TodoRepositoryPort,
} from "../../ports/todo.repository.port";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";
import { UpdateTodoScheduleCommand } from "./update-todo-schedule.command";

/**
 * Todo 일정 변경 핸들러
 *
 * 소유권 확인 → TodoSchedule VO로 일정 전이·영속화 →
 * TodoRescheduledEvent 발행(리마인더 재스케줄/취소는 이벤트 핸들러) →
 * 읽기 포트로 응답 재조회.
 */
@CommandHandler(UpdateTodoScheduleCommand)
export class UpdateTodoScheduleHandler
	implements ICommandHandler<UpdateTodoScheduleCommand, TodoResponse>
{
	readonly #logger = new Logger(UpdateTodoScheduleHandler.name);

	constructor(
		@Inject(TODO_REPOSITORY)
		private readonly todoRepository: TodoRepositoryPort,
		@Inject(TODO_READ_REPOSITORY)
		private readonly todoReadRepository: TodoReadRepositoryPort,
		private readonly eventPublisher: EventPublisher,
	) {}

	async execute(command: UpdateTodoScheduleCommand): Promise<TodoResponse> {
		const { id, userId, schedule } = command;

		// 1. 소유권 확인
		const found = await this.todoRepository.findByIdAndUserId(id, userId);
		if (!found) {
			throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
		}

		// 2. 일정 전이 (VO가 날짜 불변식 보장) + 영속화
		const todo = this.eventPublisher.mergeObjectContext(found);
		todo.reschedule(TodoSchedule.create(schedule));

		await this.todoRepository.updateSchedule(id, schedule);

		this.#logger.log(`Todo schedule updated: ${id} for user: ${userId}`);

		// 3. 저장 완료 후 이벤트 발행 (리마인더 재스케줄/취소는 이벤트 핸들러)
		todo.commit();

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
