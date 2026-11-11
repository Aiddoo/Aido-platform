import type { Provider } from "@nestjs/common";

import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { CategoryOwnershipPort } from "../todos/application/ports/category-ownership.port.js";
import { TodoCachePort } from "../todos/application/ports/todo-cache.port.js";
import { TodoReadRepositoryPort } from "../todos/application/ports/todo-read.repository.port.js";
import { TodoReminderSchedulerPort } from "../todos/application/ports/todo-reminder-scheduler.port.js";
import { TodoRepositoryPort } from "../todos/application/ports/todo.repository.port.js";
import { ApplyTodoEventsUseCase } from "../todos/application/use-cases/apply-todo-events.use-case.js";
import { TodoSeriesOwnerPort } from "./application/ports/todo-series-owner.port.js";
import { TodoSeriesRepositoryPort } from "./application/ports/todo-series.repository.port.js";
import { CatchUpTodoSeriesUseCase } from "./application/use-cases/catch-up-todo-series.use-case.js";
import { GetTodoSeriesUseCase } from "./application/use-cases/get-todo-series.use-case.js";
import { MaterializeDueTodoSeriesUseCase } from "./application/use-cases/materialize-due-todo-series.use-case.js";
import { MaterializeTodoOccurrencesUseCase } from "./application/use-cases/materialize-todo-occurrences.use-case.js";
import { MaterializeTodoSeriesUseCase } from "./application/use-cases/materialize-todo-series.use-case.js";
import { PublishTodoCreationUseCase } from "./application/use-cases/publish-todo-creation.use-case.js";
import { PublishTodoSeriesEditUseCase } from "./application/use-cases/publish-todo-series-edit.use-case.js";
import { StartSeriesFromTodoUseCase } from "./application/use-cases/start-series-from-todo.use-case.js";
import { StopTodoSeriesUseCase } from "./application/use-cases/stop-todo-series.use-case.js";
import { UpdateFollowingTodosUseCase } from "./application/use-cases/update-following-todos.use-case.js";
import { TodoSeriesOwnerAdapter } from "./infrastructure/adapters/todo-series-owner.adapter.js";
import { TodoSeriesMaterializationProcessor } from "./infrastructure/jobs/todo-series-materialization.processor.js";
import { TodoSeriesMaterializationScheduler } from "./infrastructure/jobs/todo-series-materialization.scheduler.js";
import { DrizzleTodoSeriesRepository } from "./infrastructure/persistence/drizzle-todo-series.repository.js";

export const PLANNING_TODO_SERIES_PROVIDERS = [
  { provide: TodoSeriesRepositoryPort, useClass: DrizzleTodoSeriesRepository },
  { provide: TodoSeriesOwnerPort, useClass: TodoSeriesOwnerAdapter },
  provideUseCase(PublishTodoCreationUseCase, {
    todoCache: TodoCachePort,
    logger: loggerFor(PublishTodoCreationUseCase),
  }),
  provideUseCase(PublishTodoSeriesEditUseCase, {
    todoCache: TodoCachePort,
    logger: loggerFor(PublishTodoSeriesEditUseCase),
  }),
  provideUseCase(MaterializeTodoOccurrencesUseCase, {
    todoRepository: TodoRepositoryPort,
    todoReminder: TodoReminderSchedulerPort,
    applyTodoEvents: ApplyTodoEventsUseCase,
  }),
  provideUseCase(MaterializeTodoSeriesUseCase, {
    clock: ClockPort,
    seriesRepository: TodoSeriesRepositoryPort,
    materializer: MaterializeTodoOccurrencesUseCase,
    effects: PublishTodoCreationUseCase,
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
  }),
  provideUseCase(CatchUpTodoSeriesUseCase, {
    clock: ClockPort,
    seriesRepository: TodoSeriesRepositoryPort,
    seriesOwner: TodoSeriesOwnerPort,
    dueRunner: MaterializeTodoSeriesUseCase,
    logger: loggerFor(CatchUpTodoSeriesUseCase),
  }),
  provideUseCase(MaterializeDueTodoSeriesUseCase, {
    clock: ClockPort,
    seriesRepository: TodoSeriesRepositoryPort,
    seriesOwner: TodoSeriesOwnerPort,
    dueRunner: MaterializeTodoSeriesUseCase,
    alert: OperationalAlertPort,
    logger: loggerFor(MaterializeDueTodoSeriesUseCase),
  }),
  provideUseCase(GetTodoSeriesUseCase, { seriesRepository: TodoSeriesRepositoryPort }),
  provideUseCase(StopTodoSeriesUseCase, {
    todoRepository: TodoRepositoryPort,
    seriesRepository: TodoSeriesRepositoryPort,
    todoReminder: TodoReminderSchedulerPort,
    effects: PublishTodoSeriesEditUseCase,
    mutationLock: MutationLockPort,
    applyTodoEvents: ApplyTodoEventsUseCase,
    logger: loggerFor(StopTodoSeriesUseCase),
  }),
  provideUseCase(StartSeriesFromTodoUseCase, {
    clock: ClockPort,
    todoRepository: TodoRepositoryPort,
    seriesRepository: TodoSeriesRepositoryPort,
    materializer: MaterializeTodoOccurrencesUseCase,
    todoReminder: TodoReminderSchedulerPort,
    effects: PublishTodoCreationUseCase,
    mutationLock: MutationLockPort,
  }),
  provideUseCase(UpdateFollowingTodosUseCase, {
    clock: ClockPort,
    todoRepository: TodoRepositoryPort,
    todoReadRepository: TodoReadRepositoryPort,
    seriesRepository: TodoSeriesRepositoryPort,
    categoryOwnership: CategoryOwnershipPort,
    materializer: MaterializeTodoOccurrencesUseCase,
    todoReminder: TodoReminderSchedulerPort,
    effects: PublishTodoSeriesEditUseCase,
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    applyTodoEvents: ApplyTodoEventsUseCase,
    logger: loggerFor(UpdateFollowingTodosUseCase),
  }),
  TodoSeriesMaterializationScheduler,
  TodoSeriesMaterializationProcessor,
] satisfies Provider[];
