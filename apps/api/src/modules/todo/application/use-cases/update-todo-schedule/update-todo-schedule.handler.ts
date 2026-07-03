import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, EventBus, type ICommandHandler } from "@nestjs/cqrs";
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
	implements ICommandHandler<UpdateTodoScheduleCommand>
{
	readonly #logger = new Logger(UpdateTodoScheduleHandler.name);

	constructor(
		@Inject(TODO_REPOSITORY)
		private readonly todoRepository: TodoRepositoryPort,
		@Inject(TODO_READ_REPOSITORY)
		private readonly todoReadRepository: TodoReadRepositoryPort,
		private readonly eventBus: EventBus,
	) {}

	async execute(command: UpdateTodoScheduleCommand): Promise<TodoResponse> {
		const { id, userId, schedule } = command;

		// 1. 소유권 확인
		const todo = await this.todoRepository.findByIdAndUserId(id, userId);
		if (!todo) {
			throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
		}

		// 2. 일정 전이 (VO가 날짜 불변식 보장) → 애그리게잇 상태로 영속화
		todo.reschedule(TodoSchedule.create(schedule));

		const snapshot = todo.toPersistence();
		await this.todoRepository.updateSchedule(id, {
			startDate: snapshot.startDate,
			endDate: snapshot.endDate,
			scheduledTime: snapshot.scheduledTime,
			isAllDay: snapshot.isAllDay,
		});

		this.#logger.log(`Todo schedule updated: ${id} for user: ${userId}`);

		// 3. 저장 완료 후 이벤트 발행 (리마인더 재스케줄/취소는 이벤트 핸들러)
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
