import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import {
  MutationLockKeys,
  type MutationLockPort,
  type DomainEventPublisherPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";

import { TodoSchedule } from "../../../domain/value-objects/todos/todo-schedule.vo.js";
import { PlanningTodoLogEvent } from "../../observability/todos/planning-todo-log.events.js";
import { type TodoCachePort } from "../../ports/todos/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../../ports/todos/todo.repository.port.js";
import type { TodoTimezoneResolver } from "../../services/todos/todo-timezone-resolver.service.js";

export interface UpdateTodoScheduleInput {
  readonly id: number;
  readonly userId: string;
  readonly schedule: {
    readonly startDate: Date;
    readonly endDate: Date | null;
    /** HH:mm. null이면 종일이다. */
    readonly scheduledTime: string | null;
    readonly isAllDay: boolean;
  };
  /** 요청의 시간대. 없거나 잘못되면 저장된 사용자 시간대로 해석한다. */
  readonly timezone: string | undefined;
}

interface UpdateTodoScheduleDependencies {
  readonly todoRepository: Pick<TodoRepositoryPort, "findByIdAndUserId" | "updateSchedule">;
  readonly todoReadRepository: Pick<TodoReadRepositoryPort, "findByIdAndUserId">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly timezoneResolver: Pick<TodoTimezoneResolver, "resolve">;
  readonly todoCache: Pick<TodoCachePort, "invalidateFriendTodos">;
  readonly eventPublisher: DomainEventPublisherPort;
  readonly logger: ApplicationLoggerPort;
}

export class UpdateTodoSchedule {
  readonly #dependencies: UpdateTodoScheduleDependencies;

  constructor(dependencies: UpdateTodoScheduleDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdateTodoScheduleInput): Promise<TodoResponse> {
    const { id, userId, schedule } = input;
    const timezone = await this.#dependencies.timezoneResolver.resolve(userId, input.timezone);

    const events = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([MutationLockKeys.todo(id)]);
      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(id, userId);
      if (todo == null) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
      }

      todo.reschedule(
        TodoSchedule.create({
          startDate: schedule.startDate,
          endDate: schedule.endDate,
          scheduledLocalTime: schedule.scheduledTime,
          isAllDay: schedule.isAllDay,
          timezone,
        }),
      );

      const snapshot = todo.toPersistence();
      await this.#dependencies.todoRepository.updateSchedule(id, {
        startDate: snapshot.startDate,
        endDate: snapshot.endDate,
        scheduledLocalTime: snapshot.scheduledLocalTime,
        scheduledTime: snapshot.scheduledTime,
        isAllDay: snapshot.isAllDay,
      });
      return todo.pullDomainEvents();
    });

    this.#dependencies.logger.log({
      event: PlanningTodoLogEvent.SCHEDULE_UPDATED,
      todoId: id,
      userId,
    });

    await this.#dependencies.eventPublisher.publishAll(events);

    await this.#dependencies.todoCache.invalidateFriendTodos(userId);

    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(id, userId);
    if (response == null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
    }
    return response;
  }
}
