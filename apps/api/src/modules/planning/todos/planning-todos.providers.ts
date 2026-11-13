import type { Provider } from "@nestjs/common";

import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { TodoSeriesRepositoryPort } from "../todo-series/application/ports/todo-series.repository.port.js";
import { CatchUpTodoSeriesUseCase } from "../todo-series/application/use-cases/catch-up-todo-series.use-case.js";
import { MaterializeTodoOccurrencesUseCase } from "../todo-series/application/use-cases/materialize-todo-occurrences.use-case.js";
import { PublishTodoCreationUseCase } from "../todo-series/application/use-cases/publish-todo-creation.use-case.js";
import { PublishTodoSeriesEditUseCase } from "../todo-series/application/use-cases/publish-todo-series-edit.use-case.js";
import { StartSeriesFromTodoUseCase } from "../todo-series/application/use-cases/start-series-from-todo.use-case.js";
import { StopTodoSeriesUseCase } from "../todo-series/application/use-cases/stop-todo-series.use-case.js";
import { UpdateFollowingTodosUseCase } from "../todo-series/application/use-cases/update-following-todos.use-case.js";
import { CategoryOwnershipPort } from "./application/ports/category-ownership.port.js";
import { FriendPort } from "./application/ports/friend.port.js";
import { StagedTodoCreatorPort } from "./application/ports/staged-todo-creator.port.js";
import { StreakPort } from "./application/ports/streak.port.js";
import { TodoCachePort } from "./application/ports/todo-cache.port.js";
import { TodoEngagementCounterPort } from "./application/ports/todo-engagement-counter.port.js";
import { TodoNotificationPort } from "./application/ports/todo-notification.port.js";
import { TodoOwnerTimezonePort } from "./application/ports/todo-owner-timezone.port.js";
import { TodoReadRepositoryPort } from "./application/ports/todo-read.repository.port.js";
import { TodoReminderSchedulerPort } from "./application/ports/todo-reminder-scheduler.port.js";
import { TodoViewCacheInvalidatorPort } from "./application/ports/todo-view-cache-invalidator.port.js";
import { TodoRepositoryPort } from "./application/ports/todo.repository.port.js";
import { AddTodoItemUseCase } from "./application/use-cases/add-todo-item.use-case.js";
import { ApplyTodoCompletionEffectsUseCase } from "./application/use-cases/apply-todo-completion-effects.use-case.js";
import { ApplyTodoEventsUseCase } from "./application/use-cases/apply-todo-events.use-case.js";
import { ChangeTodoCategoryUseCase } from "./application/use-cases/change-todo-category.use-case.js";
import { CreateTodoUseCase } from "./application/use-cases/create-todo.use-case.js";
import { DeleteTodoItemUseCase } from "./application/use-cases/delete-todo-item.use-case.js";
import { DeleteTodoUseCase } from "./application/use-cases/delete-todo.use-case.js";
import { EditTodoUseCase } from "./application/use-cases/edit-todo.use-case.js";
import { GetTodoOverviewUseCase } from "./application/use-cases/get-todo-overview.use-case.js";
import { GetTodoResourceLimitUseCase } from "./application/use-cases/get-todo-resource-limit.use-case.js";
import { GetTodoSummaryUseCase } from "./application/use-cases/get-todo-summary.use-case.js";
import { GetTodoUseCase } from "./application/use-cases/get-todo.use-case.js";
import { InvalidateTodoViewCacheUseCase } from "./application/use-cases/invalidate-todo-view-cache.use-case.js";
import { ListFriendTodosUseCase } from "./application/use-cases/list-friend-todos.use-case.js";
import { ListTodosUseCase } from "./application/use-cases/list-todos.use-case.js";
import { RebaseTodoTimezoneUseCase } from "./application/use-cases/rebase-todo-timezone.use-case.js";
import { ReorderTodoItemsUseCase } from "./application/use-cases/reorder-todo-items.use-case.js";
import { ReorderTodoUseCase } from "./application/use-cases/reorder-todo.use-case.js";
import { ResolveTodoTimezoneUseCase } from "./application/use-cases/resolve-todo-timezone.use-case.js";
import { SetTodoCompletedUseCase } from "./application/use-cases/set-todo-completed.use-case.js";
import { StageTodoCreationUseCase } from "./application/use-cases/stage-todo-creation.use-case.js";
import { UpdateTodoItemUseCase } from "./application/use-cases/update-todo-item.use-case.js";
import { UpdateTodoScheduleUseCase } from "./application/use-cases/update-todo-schedule.use-case.js";
import { UpdateTodoTitleUseCase } from "./application/use-cases/update-todo-title.use-case.js";
import { UpdateTodoVisibilityUseCase } from "./application/use-cases/update-todo-visibility.use-case.js";
import { UpdateTodoUseCase } from "./application/use-cases/update-todo.use-case.js";
import { WriteTodoCreationUseCase } from "./application/use-cases/write-todo-creation.use-case.js";
import { FriendAdapter } from "./infrastructure/adapters/friend.adapter.js";
import { StagedTodoCreatorAdapter } from "./infrastructure/adapters/staged-todo-creator.adapter.js";
import { StreakAdapter } from "./infrastructure/adapters/streak.adapter.js";
import { TodoNotificationAdapter } from "./infrastructure/adapters/todo-notification.adapter.js";
import { TodoViewCacheInvalidatorAdapter } from "./infrastructure/adapters/todo-view-cache-invalidator.adapter.js";
import { TodoTimezoneRebaseProcessor } from "./infrastructure/jobs/todo-timezone-rebase.processor.js";
import { DrizzleTodoEngagementCounterAdapter } from "./infrastructure/persistence/drizzle-todo-engagement-counter.adapter.js";

const MUTATION = {
  unitOfWork: UnitOfWorkPort,
  mutationLock: MutationLockPort,
} as const;

export const PLANNING_TODOS_PROVIDERS = [
  { provide: FriendPort, useClass: FriendAdapter },
  { provide: StreakPort, useClass: StreakAdapter },
  { provide: TodoNotificationPort, useClass: TodoNotificationAdapter },
  { provide: TodoEngagementCounterPort, useClass: DrizzleTodoEngagementCounterAdapter },
  provideUseCase(WriteTodoCreationUseCase, {
    clock: ClockPort,
    todoRepository: TodoRepositoryPort,
    todoSeriesRepository: TodoSeriesRepositoryPort,
    occurrenceMaterializer: MaterializeTodoOccurrencesUseCase,
    categoryOwnership: CategoryOwnershipPort,
    applyTodoEvents: ApplyTodoEventsUseCase,
  }),
  provideUseCase(StageTodoCreationUseCase, {
    writer: WriteTodoCreationUseCase,
    effects: PublishTodoCreationUseCase,
    todoReadRepository: TodoReadRepositoryPort,
    timezoneResolver: ResolveTodoTimezoneUseCase,
  }),
  { provide: StagedTodoCreatorPort, useClass: StagedTodoCreatorAdapter },
  provideUseCase(InvalidateTodoViewCacheUseCase, {
    todoReadRepository: TodoReadRepositoryPort,
    cache: TodoCachePort,
  }),
  { provide: TodoViewCacheInvalidatorPort, useClass: TodoViewCacheInvalidatorAdapter },
  provideUseCase(CreateTodoUseCase, { todoCreator: StagedTodoCreatorPort, ...MUTATION }),
  provideUseCase(DeleteTodoUseCase, {
    todoRepository: TodoRepositoryPort,
    seriesRepository: TodoSeriesRepositoryPort,
    seriesEffects: PublishTodoSeriesEditUseCase,
    todoReminder: TodoReminderSchedulerPort,
    todoCache: TodoCachePort,
    ...MUTATION,
    applyTodoEvents: ApplyTodoEventsUseCase,
    logger: loggerFor(DeleteTodoUseCase),
  }),
  provideUseCase(UpdateTodoUseCase, {
    clock: ClockPort,
    todoRepository: TodoRepositoryPort,
    todoReadRepository: TodoReadRepositoryPort,
    ...MUTATION,
    applyTodoEvents: ApplyTodoEventsUseCase,
    categoryOwnership: CategoryOwnershipPort,
    todoCache: TodoCachePort,
    logger: loggerFor(UpdateTodoUseCase),
  }),
  provideUseCase(EditTodoUseCase, {
    updateTodo: UpdateTodoUseCase,
    updateFollowingTodos: UpdateFollowingTodosUseCase,
    startSeriesFromTodo: StartSeriesFromTodoUseCase,
    stopTodoSeries: StopTodoSeriesUseCase,
    todoReadRepository: TodoReadRepositoryPort,
    ...MUTATION,
    timezoneResolver: ResolveTodoTimezoneUseCase,
    applyTodoEvents: ApplyTodoEventsUseCase,
  }),
  provideUseCase(ApplyTodoCompletionEffectsUseCase, {
    todoReadRepository: TodoReadRepositoryPort,
    friendPort: FriendPort,
    todoNotification: TodoNotificationPort,
    streakPort: StreakPort,
    clock: ClockPort,
    logger: loggerFor(ApplyTodoCompletionEffectsUseCase),
  }),
  provideUseCase(AddTodoItemUseCase, {
    clock: ClockPort,
    todoRepository: TodoRepositoryPort,
    todoReadRepository: TodoReadRepositoryPort,
    ...MUTATION,
    applyTodoEvents: ApplyTodoEventsUseCase,
    todoCache: TodoCachePort,
    completionEffects: ApplyTodoCompletionEffectsUseCase,
    logger: loggerFor(AddTodoItemUseCase),
  }),
  provideUseCase(ChangeTodoCategoryUseCase, {
    clock: ClockPort,
    todoRepository: TodoRepositoryPort,
    todoReadRepository: TodoReadRepositoryPort,
    ...MUTATION,
    applyTodoEvents: ApplyTodoEventsUseCase,
    categoryOwnership: CategoryOwnershipPort,
    todoCache: TodoCachePort,
    logger: loggerFor(ChangeTodoCategoryUseCase),
  }),
  provideUseCase(DeleteTodoItemUseCase, {
    todoRepository: TodoRepositoryPort,
    todoReadRepository: TodoReadRepositoryPort,
    ...MUTATION,
    todoCache: TodoCachePort,
    logger: loggerFor(DeleteTodoItemUseCase),
  }),
  provideUseCase(ReorderTodoUseCase, {
    todoRepository: TodoRepositoryPort,
    todoReadRepository: TodoReadRepositoryPort,
    ...MUTATION,
    todoCache: TodoCachePort,
    logger: loggerFor(ReorderTodoUseCase),
  }),
  provideUseCase(ReorderTodoItemsUseCase, {
    todoRepository: TodoRepositoryPort,
    todoReadRepository: TodoReadRepositoryPort,
    ...MUTATION,
    todoCache: TodoCachePort,
    logger: loggerFor(ReorderTodoItemsUseCase),
  }),
  provideUseCase(SetTodoCompletedUseCase, {
    clock: ClockPort,
    todoRepository: TodoRepositoryPort,
    todoReadRepository: TodoReadRepositoryPort,
    ...MUTATION,
    applyTodoEvents: ApplyTodoEventsUseCase,
    todoCache: TodoCachePort,
    completionEffects: ApplyTodoCompletionEffectsUseCase,
    logger: loggerFor(SetTodoCompletedUseCase),
  }),
  provideUseCase(UpdateTodoItemUseCase, {
    clock: ClockPort,
    todoRepository: TodoRepositoryPort,
    todoReadRepository: TodoReadRepositoryPort,
    ...MUTATION,
    todoCache: TodoCachePort,
    logger: loggerFor(UpdateTodoItemUseCase),
  }),
  provideUseCase(UpdateTodoScheduleUseCase, {
    clock: ClockPort,
    todoRepository: TodoRepositoryPort,
    todoReadRepository: TodoReadRepositoryPort,
    ...MUTATION,
    applyTodoEvents: ApplyTodoEventsUseCase,
    timezoneResolver: ResolveTodoTimezoneUseCase,
    todoCache: TodoCachePort,
    logger: loggerFor(UpdateTodoScheduleUseCase),
  }),
  provideUseCase(UpdateTodoTitleUseCase, {
    clock: ClockPort,
    todoRepository: TodoRepositoryPort,
    todoReadRepository: TodoReadRepositoryPort,
    ...MUTATION,
    applyTodoEvents: ApplyTodoEventsUseCase,
    todoCache: TodoCachePort,
    logger: loggerFor(UpdateTodoTitleUseCase),
  }),
  provideUseCase(UpdateTodoVisibilityUseCase, {
    clock: ClockPort,
    todoRepository: TodoRepositoryPort,
    todoReadRepository: TodoReadRepositoryPort,
    ...MUTATION,
    applyTodoEvents: ApplyTodoEventsUseCase,
    todoCache: TodoCachePort,
    logger: loggerFor(UpdateTodoVisibilityUseCase),
  }),
  provideUseCase(RebaseTodoTimezoneUseCase, {
    clock: ClockPort,
    todoRepository: TodoRepositoryPort,
    seriesRepository: TodoSeriesRepositoryPort,
    ownerTimezone: TodoOwnerTimezonePort,
    todoReminder: TodoReminderSchedulerPort,
    todoCache: TodoCachePort,
    ...MUTATION,
    logger: loggerFor(RebaseTodoTimezoneUseCase),
  }),
  provideUseCase(GetTodoUseCase, { todoReadRepository: TodoReadRepositoryPort }),
  provideUseCase(ListTodosUseCase, {
    todoReadRepository: TodoReadRepositoryPort,
    seriesCatchUp: CatchUpTodoSeriesUseCase,
  }),
  provideUseCase(ListFriendTodosUseCase, {
    todoReadRepository: TodoReadRepositoryPort,
    friendPort: FriendPort,
    todoCache: TodoCachePort,
  }),
  provideUseCase(GetTodoResourceLimitUseCase, { todoReadRepository: TodoReadRepositoryPort }),
  provideUseCase(GetTodoSummaryUseCase, {
    todoReadRepository: TodoReadRepositoryPort,
    streakPort: StreakPort,
    seriesCatchUp: CatchUpTodoSeriesUseCase,
  }),
  provideUseCase(GetTodoOverviewUseCase, {
    todoReadRepository: TodoReadRepositoryPort,
    seriesRepository: TodoSeriesRepositoryPort,
    seriesCatchUp: CatchUpTodoSeriesUseCase,
  }),
  TodoTimezoneRebaseProcessor,
] satisfies Provider[];
