import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";

import { TodoSchedule } from "../../../shared/domain/todo-schedule.vo.js";
import { type TodoCachePort } from "../ports/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";
import { type TodoRepositoryPort } from "../ports/todo.repository.port.js";
import type { TodoReadModel } from "../read-models/todo.read-model.js";
import { TodoLogEvent } from "../todos.log-events.js";
import type { ApplyTodoEventsUseCase } from "./apply-todo-events.use-case.js";
import type { ResolveTodoTimezoneUseCase } from "./resolve-todo-timezone.use-case.js";

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
  readonly applyTodoEvents: Pick<ApplyTodoEventsUseCase, "execute">;
  readonly mutationLock: MutationLockPort;
  readonly clock: ClockPort;
  readonly timezoneResolver: Pick<ResolveTodoTimezoneUseCase, "execute">;
  readonly todoCache: Pick<TodoCachePort, "invalidateFriendTodos">;
  readonly logger: ApplicationLoggerPort;
}

export class UpdateTodoScheduleUseCase {
  readonly #dependencies: UpdateTodoScheduleDependencies;

  constructor(dependencies: UpdateTodoScheduleDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: UpdateTodoScheduleInput): Promise<TodoReadModel> {
    const { id, userId, schedule } = input;
    const timezone = await this.#dependencies.timezoneResolver.execute(userId, input.timezone);

    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([MutationLockKeys.todo(id)]);
      const todo = await this.#dependencies.todoRepository.findByIdAndUserId(id, userId);
      if (todo == null) {
        throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
      }

      const rescheduled = todo.reschedule(
        TodoSchedule.create({
          startDate: schedule.startDate,
          endDate: schedule.endDate,
          scheduledLocalTime: schedule.scheduledTime,
          isAllDay: schedule.isAllDay,
          timezone,
        }),
        this.#dependencies.clock.now(),
      );
      if (!rescheduled) {
        return;
      }
      await this.#dependencies.todoRepository.updateSchedule(id, todo.schedule.toPrimitives());
      await this.#dependencies.applyTodoEvents.execute(todo.pullDomainEvents());
    });

    this.#dependencies.logger.log({
      event: TodoLogEvent.SCHEDULE_UPDATED,
      todoId: id,
      userId,
    });

    await this.#dependencies.todoCache.invalidateFriendTodos(userId);

    const response = await this.#dependencies.todoReadRepository.findByIdAndUserId(id, userId);
    if (response == null) {
      throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
    }
    return response;
  }
}
