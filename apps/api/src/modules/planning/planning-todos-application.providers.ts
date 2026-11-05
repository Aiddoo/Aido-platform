import { Logger, type FactoryProvider } from "@nestjs/common";

import { PaginationService } from "#api/shared/application/pagination/index";
import {
  UNIT_OF_WORK,
  DOMAIN_EVENT_PUBLISHER,
  MUTATION_LOCK,
} from "#api/shared/application/ports/index";
import { OPERATIONAL_ALERT } from "#api/shared/application/ports/operational-alert.port";

import { TODO_SERIES_OWNER } from "./application/ports/series/todo-series-owner.port.js";
import { TODO_SERIES_REPOSITORY } from "./application/ports/series/todo-series.repository.port.js";
import { CATEGORY_OWNERSHIP } from "./application/ports/todos/category-ownership.port.js";
import { FRIEND_PORT } from "./application/ports/todos/friend.port.js";
import { STREAK_PORT } from "./application/ports/todos/streak.port.js";
import { TODO_CACHE } from "./application/ports/todos/todo-cache.port.js";
import { TODO_OWNER_TIMEZONE } from "./application/ports/todos/todo-owner-timezone.port.js";
import { TODO_READ_REPOSITORY } from "./application/ports/todos/todo-read.repository.port.js";
import { TODO_REMINDER } from "./application/ports/todos/todo-reminder.port.js";
import { TODO_REPOSITORY } from "./application/ports/todos/todo.repository.port.js";
import { TodoOccurrenceMaterializer } from "./application/services/series/todo-occurrence-materializer.service.js";
import { TodoSeriesCatchUp } from "./application/services/series/todo-series-catch-up.service.js";
import { TodoSeriesDueRun } from "./application/services/series/todo-series-due-run.service.js";
import { TodoSeriesEditEffects } from "./application/services/series/todo-series-edit-effects.service.js";
import { StagedTodoCreator } from "./application/services/todos/staged-todo-creator.service.js";
import { TodoCreationEffects } from "./application/services/todos/todo-creation-effects.service.js";
import { TodoCreationWriter } from "./application/services/todos/todo-creation-writer.service.js";
import { TodoTimezoneResolver } from "./application/services/todos/todo-timezone-resolver.service.js";
import { GetTodoSeries } from "./application/use-cases/series/get-todo-series.use-case.js";
import { MaterializeDueTodoSeries } from "./application/use-cases/series/materialize-due-todo-series.use-case.js";
import { StartSeriesFromTodo } from "./application/use-cases/series/start-series-from-todo.use-case.js";
import { StopTodoSeries } from "./application/use-cases/series/stop-todo-series.use-case.js";
import { UpdateFollowingTodos } from "./application/use-cases/series/update-following-todos.use-case.js";
import { AddTodoItem } from "./application/use-cases/todos/add-todo-item.use-case.js";
import { ChangeTodoCategory } from "./application/use-cases/todos/change-todo-category.use-case.js";
import { CreateTodo } from "./application/use-cases/todos/create-todo.use-case.js";
import { DeleteTodoItem } from "./application/use-cases/todos/delete-todo-item.use-case.js";
import { DeleteTodo } from "./application/use-cases/todos/delete-todo.use-case.js";
import { EditTodo } from "./application/use-cases/todos/edit-todo.use-case.js";
import { GetFriendTodos } from "./application/use-cases/todos/get-friend-todos.use-case.js";
import { GetTodoById } from "./application/use-cases/todos/get-todo-by-id.use-case.js";
import { GetTodoResourceLimit } from "./application/use-cases/todos/get-todo-resource-limit.use-case.js";
import { GetTodoSummary } from "./application/use-cases/todos/get-todo-summary.use-case.js";
import { GetTodos } from "./application/use-cases/todos/get-todos.use-case.js";
import { RebaseTodoTimezone } from "./application/use-cases/todos/rebase-todo-timezone.use-case.js";
import { ReorderTodoItems } from "./application/use-cases/todos/reorder-todo-items.use-case.js";
import { ReorderTodo } from "./application/use-cases/todos/reorder-todo.use-case.js";
import { ToggleTodoComplete } from "./application/use-cases/todos/toggle-todo-complete.use-case.js";
import { UpdateTodoItem } from "./application/use-cases/todos/update-todo-item.use-case.js";
import { UpdateTodoSchedule } from "./application/use-cases/todos/update-todo-schedule.use-case.js";
import { UpdateTodoTitle } from "./application/use-cases/todos/update-todo-title.use-case.js";
import { UpdateTodoVisibility } from "./application/use-cases/todos/update-todo-visibility.use-case.js";
import { UpdateTodo } from "./application/use-cases/todos/update-todo.use-case.js";

export const todoTimezoneResolverProvider: FactoryProvider<TodoTimezoneResolver> = {
  provide: TodoTimezoneResolver,
  inject: [TODO_OWNER_TIMEZONE],
  useFactory: (
    ownerTimezone: ConstructorParameters<typeof TodoTimezoneResolver>[0]["ownerTimezone"],
  ) => new TodoTimezoneResolver({ ownerTimezone }),
};

export const rebaseTodoTimezoneProvider: FactoryProvider<RebaseTodoTimezone> = {
  provide: RebaseTodoTimezone,
  inject: [
    TODO_REPOSITORY,
    TODO_SERIES_REPOSITORY,
    TODO_OWNER_TIMEZONE,
    TODO_REMINDER,
    TODO_CACHE,
    UNIT_OF_WORK,
    MUTATION_LOCK,
  ],
  useFactory: (
    todoRepository: ConstructorParameters<typeof RebaseTodoTimezone>[0]["todoRepository"],
    seriesRepository: ConstructorParameters<typeof RebaseTodoTimezone>[0]["seriesRepository"],
    ownerTimezone: ConstructorParameters<typeof RebaseTodoTimezone>[0]["ownerTimezone"],
    todoReminder: ConstructorParameters<typeof RebaseTodoTimezone>[0]["todoReminder"],
    todoCache: ConstructorParameters<typeof RebaseTodoTimezone>[0]["todoCache"],
    unitOfWork: ConstructorParameters<typeof RebaseTodoTimezone>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof RebaseTodoTimezone>[0]["mutationLock"],
  ) =>
    new RebaseTodoTimezone({
      todoRepository,
      seriesRepository,
      ownerTimezone,
      todoReminder,
      todoCache,
      unitOfWork,
      mutationLock,
      logger: new Logger(RebaseTodoTimezone.name),
    }),
};

export const todoSeriesDueRunProvider: FactoryProvider<TodoSeriesDueRun> = {
  provide: TodoSeriesDueRun,
  inject: [
    TODO_SERIES_REPOSITORY,
    TodoOccurrenceMaterializer,
    TodoCreationEffects,
    UNIT_OF_WORK,
    MUTATION_LOCK,
  ],
  useFactory: (
    seriesRepository: ConstructorParameters<typeof TodoSeriesDueRun>[0]["seriesRepository"],
    materializer: ConstructorParameters<typeof TodoSeriesDueRun>[0]["materializer"],
    effects: ConstructorParameters<typeof TodoSeriesDueRun>[0]["effects"],
    unitOfWork: ConstructorParameters<typeof TodoSeriesDueRun>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof TodoSeriesDueRun>[0]["mutationLock"],
  ) => new TodoSeriesDueRun({ seriesRepository, materializer, effects, unitOfWork, mutationLock }),
};

export const todoSeriesCatchUpProvider: FactoryProvider<TodoSeriesCatchUp> = {
  provide: TodoSeriesCatchUp,
  inject: [TODO_SERIES_REPOSITORY, TODO_SERIES_OWNER, TodoSeriesDueRun],
  useFactory: (
    seriesRepository: ConstructorParameters<typeof TodoSeriesCatchUp>[0]["seriesRepository"],
    seriesOwner: ConstructorParameters<typeof TodoSeriesCatchUp>[0]["seriesOwner"],
    dueRun: ConstructorParameters<typeof TodoSeriesCatchUp>[0]["dueRun"],
  ) =>
    new TodoSeriesCatchUp({
      seriesRepository,
      seriesOwner,
      dueRun,
      logger: new Logger(TodoSeriesCatchUp.name),
    }),
};

export const materializeDueTodoSeriesProvider: FactoryProvider<MaterializeDueTodoSeries> = {
  provide: MaterializeDueTodoSeries,
  inject: [TODO_SERIES_REPOSITORY, TODO_SERIES_OWNER, TodoSeriesDueRun, OPERATIONAL_ALERT],
  useFactory: (
    seriesRepository: ConstructorParameters<typeof MaterializeDueTodoSeries>[0]["seriesRepository"],
    seriesOwner: ConstructorParameters<typeof MaterializeDueTodoSeries>[0]["seriesOwner"],
    dueRun: ConstructorParameters<typeof MaterializeDueTodoSeries>[0]["dueRun"],
    alert: ConstructorParameters<typeof MaterializeDueTodoSeries>[0]["alert"],
  ) =>
    new MaterializeDueTodoSeries({
      seriesRepository,
      seriesOwner,
      dueRun,
      alert,
      logger: new Logger(MaterializeDueTodoSeries.name),
    }),
};

export const getFriendTodosProvider: FactoryProvider<GetFriendTodos> = {
  provide: GetFriendTodos,
  inject: [TODO_READ_REPOSITORY, PaginationService, FRIEND_PORT, TODO_CACHE],
  useFactory: (
    todoReadRepository: ConstructorParameters<typeof GetFriendTodos>[0]["todoReadRepository"],
    paginationService: ConstructorParameters<typeof GetFriendTodos>[0]["paginationService"],
    friendPort: ConstructorParameters<typeof GetFriendTodos>[0]["friendPort"],
    todoCache: ConstructorParameters<typeof GetFriendTodos>[0]["todoCache"],
  ) =>
    new GetFriendTodos({
      todoReadRepository,
      paginationService,
      friendPort,
      todoCache,
    }),
};

export const getTodoByIdProvider: FactoryProvider<GetTodoById> = {
  provide: GetTodoById,
  inject: [TODO_READ_REPOSITORY],
  useFactory: (
    todoReadRepository: ConstructorParameters<typeof GetTodoById>[0]["todoReadRepository"],
  ) => new GetTodoById({ todoReadRepository }),
};

export const getTodoResourceLimitProvider: FactoryProvider<GetTodoResourceLimit> = {
  provide: GetTodoResourceLimit,
  inject: [TODO_READ_REPOSITORY],
  useFactory: (
    todoReadRepository: ConstructorParameters<typeof GetTodoResourceLimit>[0]["todoReadRepository"],
  ) => new GetTodoResourceLimit({ todoReadRepository }),
};

export const getTodoSummaryProvider: FactoryProvider<GetTodoSummary> = {
  provide: GetTodoSummary,
  inject: [TODO_READ_REPOSITORY, STREAK_PORT, TodoSeriesCatchUp],
  useFactory: (
    todoReadRepository: ConstructorParameters<typeof GetTodoSummary>[0]["todoReadRepository"],
    streakPort: ConstructorParameters<typeof GetTodoSummary>[0]["streakPort"],
    seriesCatchUp: ConstructorParameters<typeof GetTodoSummary>[0]["seriesCatchUp"],
  ) => new GetTodoSummary({ todoReadRepository, streakPort, seriesCatchUp }),
};

export const getTodosProvider: FactoryProvider<GetTodos> = {
  provide: GetTodos,
  inject: [TODO_READ_REPOSITORY, PaginationService, TodoSeriesCatchUp],
  useFactory: (
    todoReadRepository: ConstructorParameters<typeof GetTodos>[0]["todoReadRepository"],
    paginationService: ConstructorParameters<typeof GetTodos>[0]["paginationService"],
    seriesCatchUp: ConstructorParameters<typeof GetTodos>[0]["seriesCatchUp"],
  ) =>
    new GetTodos({
      todoReadRepository,
      paginationService,
      seriesCatchUp,
    }),
};

export const addTodoItemProvider: FactoryProvider<AddTodoItem> = {
  provide: AddTodoItem,
  inject: [
    TODO_REPOSITORY,
    TODO_READ_REPOSITORY,
    UNIT_OF_WORK,
    MUTATION_LOCK,
    TODO_CACHE,
    DOMAIN_EVENT_PUBLISHER,
  ],
  useFactory: (
    todoRepository: ConstructorParameters<typeof AddTodoItem>[0]["todoRepository"],
    todoReadRepository: ConstructorParameters<typeof AddTodoItem>[0]["todoReadRepository"],
    unitOfWork: ConstructorParameters<typeof AddTodoItem>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof AddTodoItem>[0]["mutationLock"],
    todoCache: ConstructorParameters<typeof AddTodoItem>[0]["todoCache"],
    eventPublisher: ConstructorParameters<typeof AddTodoItem>[0]["eventPublisher"],
  ) =>
    new AddTodoItem({
      todoRepository,
      todoReadRepository,
      unitOfWork,
      mutationLock,
      todoCache,
      eventPublisher,
      logger: new Logger(AddTodoItem.name),
    }),
};

export const changeTodoCategoryProvider: FactoryProvider<ChangeTodoCategory> = {
  provide: ChangeTodoCategory,
  inject: [
    TODO_REPOSITORY,
    TODO_READ_REPOSITORY,
    UNIT_OF_WORK,
    MUTATION_LOCK,
    CATEGORY_OWNERSHIP,
    TODO_CACHE,
    DOMAIN_EVENT_PUBLISHER,
  ],
  useFactory: (
    todoRepository: ConstructorParameters<typeof ChangeTodoCategory>[0]["todoRepository"],
    todoReadRepository: ConstructorParameters<typeof ChangeTodoCategory>[0]["todoReadRepository"],
    unitOfWork: ConstructorParameters<typeof ChangeTodoCategory>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof ChangeTodoCategory>[0]["mutationLock"],
    categoryOwnership: ConstructorParameters<typeof ChangeTodoCategory>[0]["categoryOwnership"],
    todoCache: ConstructorParameters<typeof ChangeTodoCategory>[0]["todoCache"],
    eventPublisher: ConstructorParameters<typeof ChangeTodoCategory>[0]["eventPublisher"],
  ) =>
    new ChangeTodoCategory({
      todoRepository,
      todoReadRepository,
      unitOfWork,
      mutationLock,
      categoryOwnership,
      todoCache,
      eventPublisher,
      logger: new Logger(ChangeTodoCategory.name),
    }),
};

export const todoOccurrenceMaterializerProvider: FactoryProvider<TodoOccurrenceMaterializer> = {
  provide: TodoOccurrenceMaterializer,
  inject: [TODO_REPOSITORY, TODO_REMINDER],
  useFactory: (
    todoRepository: ConstructorParameters<typeof TodoOccurrenceMaterializer>[0]["todoRepository"],
    todoReminder: ConstructorParameters<typeof TodoOccurrenceMaterializer>[0]["todoReminder"],
  ) => new TodoOccurrenceMaterializer({ todoRepository, todoReminder }),
};

export const todoCreationWriterProvider: FactoryProvider<TodoCreationWriter> = {
  provide: TodoCreationWriter,
  inject: [TODO_REPOSITORY, TODO_SERIES_REPOSITORY, TodoOccurrenceMaterializer, CATEGORY_OWNERSHIP],
  useFactory: (
    todoRepository: ConstructorParameters<typeof TodoCreationWriter>[0]["todoRepository"],
    todoSeriesRepository: ConstructorParameters<
      typeof TodoCreationWriter
    >[0]["todoSeriesRepository"],
    occurrenceMaterializer: ConstructorParameters<
      typeof TodoCreationWriter
    >[0]["occurrenceMaterializer"],
    categoryOwnership: ConstructorParameters<typeof TodoCreationWriter>[0]["categoryOwnership"],
  ) =>
    new TodoCreationWriter({
      todoRepository,
      todoSeriesRepository,
      occurrenceMaterializer,
      categoryOwnership,
    }),
};

export const todoCreationEffectsProvider: FactoryProvider<TodoCreationEffects> = {
  provide: TodoCreationEffects,
  inject: [TODO_CACHE, DOMAIN_EVENT_PUBLISHER],
  useFactory: (
    todoCache: ConstructorParameters<typeof TodoCreationEffects>[0]["todoCache"],
    eventPublisher: ConstructorParameters<typeof TodoCreationEffects>[0]["eventPublisher"],
  ) =>
    new TodoCreationEffects({
      todoCache,
      eventPublisher,
      logger: new Logger(TodoCreationEffects.name),
    }),
};

export const stagedTodoCreatorProvider: FactoryProvider<StagedTodoCreator> = {
  provide: StagedTodoCreator,
  inject: [TodoCreationWriter, TodoCreationEffects, TODO_READ_REPOSITORY, TodoTimezoneResolver],
  useFactory: (
    writer: ConstructorParameters<typeof StagedTodoCreator>[0]["writer"],
    effects: ConstructorParameters<typeof StagedTodoCreator>[0]["effects"],
    todoReadRepository: ConstructorParameters<typeof StagedTodoCreator>[0]["todoReadRepository"],
    timezoneResolver: ConstructorParameters<typeof StagedTodoCreator>[0]["timezoneResolver"],
  ) => new StagedTodoCreator({ writer, effects, todoReadRepository, timezoneResolver }),
};

export const createTodoProvider: FactoryProvider<CreateTodo> = {
  provide: CreateTodo,
  inject: [StagedTodoCreator, UNIT_OF_WORK, MUTATION_LOCK],
  useFactory: (
    todoCreator: ConstructorParameters<typeof CreateTodo>[0]["todoCreator"],
    unitOfWork: ConstructorParameters<typeof CreateTodo>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof CreateTodo>[0]["mutationLock"],
  ) => new CreateTodo({ todoCreator, unitOfWork, mutationLock }),
};

export const deleteTodoProvider: FactoryProvider<DeleteTodo> = {
  provide: DeleteTodo,
  inject: [
    TODO_REPOSITORY,
    TODO_SERIES_REPOSITORY,
    TodoSeriesEditEffects,
    TODO_REMINDER,
    TODO_CACHE,
    UNIT_OF_WORK,
    MUTATION_LOCK,
    DOMAIN_EVENT_PUBLISHER,
  ],
  useFactory: (
    todoRepository: ConstructorParameters<typeof DeleteTodo>[0]["todoRepository"],
    seriesRepository: ConstructorParameters<typeof DeleteTodo>[0]["seriesRepository"],
    seriesEffects: ConstructorParameters<typeof DeleteTodo>[0]["seriesEffects"],
    todoReminder: ConstructorParameters<typeof DeleteTodo>[0]["todoReminder"],
    todoCache: ConstructorParameters<typeof DeleteTodo>[0]["todoCache"],
    unitOfWork: ConstructorParameters<typeof DeleteTodo>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof DeleteTodo>[0]["mutationLock"],
    eventPublisher: ConstructorParameters<typeof DeleteTodo>[0]["eventPublisher"],
  ) =>
    new DeleteTodo({
      todoRepository,
      seriesRepository,
      seriesEffects,
      todoReminder,
      todoCache,
      unitOfWork,
      mutationLock,
      eventPublisher,
      logger: new Logger(DeleteTodo.name),
    }),
};

export const todoSeriesEditEffectsProvider: FactoryProvider<TodoSeriesEditEffects> = {
  provide: TodoSeriesEditEffects,
  inject: [TODO_CACHE, DOMAIN_EVENT_PUBLISHER],
  useFactory: (
    todoCache: ConstructorParameters<typeof TodoSeriesEditEffects>[0]["todoCache"],
    eventPublisher: ConstructorParameters<typeof TodoSeriesEditEffects>[0]["eventPublisher"],
  ) =>
    new TodoSeriesEditEffects({
      todoCache,
      eventPublisher,
      logger: new Logger(TodoSeriesEditEffects.name),
    }),
};

export const getTodoSeriesProvider: FactoryProvider<GetTodoSeries> = {
  provide: GetTodoSeries,
  inject: [TODO_SERIES_REPOSITORY],
  useFactory: (
    seriesRepository: ConstructorParameters<typeof GetTodoSeries>[0]["seriesRepository"],
  ) => new GetTodoSeries({ seriesRepository }),
};

export const stopTodoSeriesProvider: FactoryProvider<StopTodoSeries> = {
  provide: StopTodoSeries,
  inject: [
    TODO_REPOSITORY,
    TODO_SERIES_REPOSITORY,
    TODO_REMINDER,
    TodoSeriesEditEffects,
    MUTATION_LOCK,
  ],
  useFactory: (
    todoRepository: ConstructorParameters<typeof StopTodoSeries>[0]["todoRepository"],
    seriesRepository: ConstructorParameters<typeof StopTodoSeries>[0]["seriesRepository"],
    todoReminder: ConstructorParameters<typeof StopTodoSeries>[0]["todoReminder"],
    effects: ConstructorParameters<typeof StopTodoSeries>[0]["effects"],
    mutationLock: ConstructorParameters<typeof StopTodoSeries>[0]["mutationLock"],
  ) =>
    new StopTodoSeries({
      todoRepository,
      seriesRepository,
      todoReminder,
      effects,
      mutationLock,
      logger: new Logger(StopTodoSeries.name),
    }),
};

export const startSeriesFromTodoProvider: FactoryProvider<StartSeriesFromTodo> = {
  provide: StartSeriesFromTodo,
  inject: [
    TODO_REPOSITORY,
    TODO_SERIES_REPOSITORY,
    TodoOccurrenceMaterializer,
    TODO_REMINDER,
    TodoCreationEffects,
    MUTATION_LOCK,
  ],
  useFactory: (
    todoRepository: ConstructorParameters<typeof StartSeriesFromTodo>[0]["todoRepository"],
    seriesRepository: ConstructorParameters<typeof StartSeriesFromTodo>[0]["seriesRepository"],
    materializer: ConstructorParameters<typeof StartSeriesFromTodo>[0]["materializer"],
    todoReminder: ConstructorParameters<typeof StartSeriesFromTodo>[0]["todoReminder"],
    effects: ConstructorParameters<typeof StartSeriesFromTodo>[0]["effects"],
    mutationLock: ConstructorParameters<typeof StartSeriesFromTodo>[0]["mutationLock"],
  ) =>
    new StartSeriesFromTodo({
      todoRepository,
      seriesRepository,
      materializer,
      todoReminder,
      effects,
      mutationLock,
    }),
};

export const updateFollowingTodosProvider: FactoryProvider<UpdateFollowingTodos> = {
  provide: UpdateFollowingTodos,
  inject: [
    TODO_REPOSITORY,
    TODO_READ_REPOSITORY,
    TODO_SERIES_REPOSITORY,
    CATEGORY_OWNERSHIP,
    TodoOccurrenceMaterializer,
    TODO_REMINDER,
    TodoSeriesEditEffects,
    UNIT_OF_WORK,
    MUTATION_LOCK,
  ],
  useFactory: (
    todoRepository: ConstructorParameters<typeof UpdateFollowingTodos>[0]["todoRepository"],
    todoReadRepository: ConstructorParameters<typeof UpdateFollowingTodos>[0]["todoReadRepository"],
    seriesRepository: ConstructorParameters<typeof UpdateFollowingTodos>[0]["seriesRepository"],
    categoryOwnership: ConstructorParameters<typeof UpdateFollowingTodos>[0]["categoryOwnership"],
    materializer: ConstructorParameters<typeof UpdateFollowingTodos>[0]["materializer"],
    todoReminder: ConstructorParameters<typeof UpdateFollowingTodos>[0]["todoReminder"],
    effects: ConstructorParameters<typeof UpdateFollowingTodos>[0]["effects"],
    unitOfWork: ConstructorParameters<typeof UpdateFollowingTodos>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof UpdateFollowingTodos>[0]["mutationLock"],
  ) =>
    new UpdateFollowingTodos({
      todoRepository,
      todoReadRepository,
      seriesRepository,
      categoryOwnership,
      materializer,
      todoReminder,
      effects,
      unitOfWork,
      mutationLock,
      logger: new Logger(UpdateFollowingTodos.name),
    }),
};

export const deleteTodoItemProvider: FactoryProvider<DeleteTodoItem> = {
  provide: DeleteTodoItem,
  inject: [TODO_REPOSITORY, TODO_READ_REPOSITORY, UNIT_OF_WORK, MUTATION_LOCK, TODO_CACHE],
  useFactory: (
    todoRepository: ConstructorParameters<typeof DeleteTodoItem>[0]["todoRepository"],
    todoReadRepository: ConstructorParameters<typeof DeleteTodoItem>[0]["todoReadRepository"],
    unitOfWork: ConstructorParameters<typeof DeleteTodoItem>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof DeleteTodoItem>[0]["mutationLock"],
    todoCache: ConstructorParameters<typeof DeleteTodoItem>[0]["todoCache"],
  ) =>
    new DeleteTodoItem({
      todoRepository,
      todoReadRepository,
      unitOfWork,
      mutationLock,
      todoCache,
      logger: new Logger(DeleteTodoItem.name),
    }),
};

export const reorderTodoProvider: FactoryProvider<ReorderTodo> = {
  provide: ReorderTodo,
  inject: [TODO_REPOSITORY, TODO_READ_REPOSITORY, UNIT_OF_WORK, MUTATION_LOCK, TODO_CACHE],
  useFactory: (
    todoRepository: ConstructorParameters<typeof ReorderTodo>[0]["todoRepository"],
    todoReadRepository: ConstructorParameters<typeof ReorderTodo>[0]["todoReadRepository"],
    unitOfWork: ConstructorParameters<typeof ReorderTodo>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof ReorderTodo>[0]["mutationLock"],
    todoCache: ConstructorParameters<typeof ReorderTodo>[0]["todoCache"],
  ) =>
    new ReorderTodo({
      todoRepository,
      todoReadRepository,
      unitOfWork,
      mutationLock,
      todoCache,
      logger: new Logger(ReorderTodo.name),
    }),
};

export const reorderTodoItemsProvider: FactoryProvider<ReorderTodoItems> = {
  provide: ReorderTodoItems,
  inject: [TODO_REPOSITORY, TODO_READ_REPOSITORY, UNIT_OF_WORK, MUTATION_LOCK, TODO_CACHE],
  useFactory: (
    todoRepository: ConstructorParameters<typeof ReorderTodoItems>[0]["todoRepository"],
    todoReadRepository: ConstructorParameters<typeof ReorderTodoItems>[0]["todoReadRepository"],
    unitOfWork: ConstructorParameters<typeof ReorderTodoItems>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof ReorderTodoItems>[0]["mutationLock"],
    todoCache: ConstructorParameters<typeof ReorderTodoItems>[0]["todoCache"],
  ) =>
    new ReorderTodoItems({
      todoRepository,
      todoReadRepository,
      unitOfWork,
      mutationLock,
      todoCache,
      logger: new Logger(ReorderTodoItems.name),
    }),
};

export const toggleTodoCompleteProvider: FactoryProvider<ToggleTodoComplete> = {
  provide: ToggleTodoComplete,
  inject: [
    TODO_REPOSITORY,
    TODO_READ_REPOSITORY,
    UNIT_OF_WORK,
    MUTATION_LOCK,
    TODO_CACHE,
    DOMAIN_EVENT_PUBLISHER,
  ],
  useFactory: (
    todoRepository: ConstructorParameters<typeof ToggleTodoComplete>[0]["todoRepository"],
    todoReadRepository: ConstructorParameters<typeof ToggleTodoComplete>[0]["todoReadRepository"],
    unitOfWork: ConstructorParameters<typeof ToggleTodoComplete>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof ToggleTodoComplete>[0]["mutationLock"],
    todoCache: ConstructorParameters<typeof ToggleTodoComplete>[0]["todoCache"],
    eventPublisher: ConstructorParameters<typeof ToggleTodoComplete>[0]["eventPublisher"],
  ) =>
    new ToggleTodoComplete({
      todoRepository,
      todoReadRepository,
      unitOfWork,
      mutationLock,
      todoCache,
      eventPublisher,
      logger: new Logger(ToggleTodoComplete.name),
    }),
};

export const editTodoProvider: FactoryProvider<EditTodo> = {
  provide: EditTodo,
  inject: [
    UpdateTodo,
    UpdateFollowingTodos,
    StartSeriesFromTodo,
    StopTodoSeries,
    TODO_READ_REPOSITORY,
    UNIT_OF_WORK,
    MUTATION_LOCK,
    TodoTimezoneResolver,
  ],
  useFactory: (
    updateTodo: ConstructorParameters<typeof EditTodo>[0]["updateTodo"],
    updateFollowingTodos: ConstructorParameters<typeof EditTodo>[0]["updateFollowingTodos"],
    startSeriesFromTodo: ConstructorParameters<typeof EditTodo>[0]["startSeriesFromTodo"],
    stopTodoSeries: ConstructorParameters<typeof EditTodo>[0]["stopTodoSeries"],
    todoReadRepository: ConstructorParameters<typeof EditTodo>[0]["todoReadRepository"],
    unitOfWork: ConstructorParameters<typeof EditTodo>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof EditTodo>[0]["mutationLock"],
    timezoneResolver: ConstructorParameters<typeof EditTodo>[0]["timezoneResolver"],
  ) =>
    new EditTodo({
      updateTodo,
      updateFollowingTodos,
      startSeriesFromTodo,
      stopTodoSeries,
      todoReadRepository,
      unitOfWork,
      mutationLock,
      timezoneResolver,
    }),
};

export const updateTodoProvider: FactoryProvider<UpdateTodo> = {
  provide: UpdateTodo,
  inject: [
    TODO_REPOSITORY,
    TODO_READ_REPOSITORY,
    UNIT_OF_WORK,
    MUTATION_LOCK,
    CATEGORY_OWNERSHIP,
    TODO_CACHE,
    DOMAIN_EVENT_PUBLISHER,
  ],
  useFactory: (
    todoRepository: ConstructorParameters<typeof UpdateTodo>[0]["todoRepository"],
    todoReadRepository: ConstructorParameters<typeof UpdateTodo>[0]["todoReadRepository"],
    unitOfWork: ConstructorParameters<typeof UpdateTodo>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof UpdateTodo>[0]["mutationLock"],
    categoryOwnership: ConstructorParameters<typeof UpdateTodo>[0]["categoryOwnership"],
    todoCache: ConstructorParameters<typeof UpdateTodo>[0]["todoCache"],
    eventPublisher: ConstructorParameters<typeof UpdateTodo>[0]["eventPublisher"],
  ) =>
    new UpdateTodo({
      todoRepository,
      todoReadRepository,
      unitOfWork,
      mutationLock,
      categoryOwnership,
      todoCache,
      eventPublisher,
      logger: new Logger(UpdateTodo.name),
    }),
};

export const updateTodoItemProvider: FactoryProvider<UpdateTodoItem> = {
  provide: UpdateTodoItem,
  inject: [TODO_REPOSITORY, TODO_READ_REPOSITORY, UNIT_OF_WORK, MUTATION_LOCK, TODO_CACHE],
  useFactory: (
    todoRepository: ConstructorParameters<typeof UpdateTodoItem>[0]["todoRepository"],
    todoReadRepository: ConstructorParameters<typeof UpdateTodoItem>[0]["todoReadRepository"],
    unitOfWork: ConstructorParameters<typeof UpdateTodoItem>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof UpdateTodoItem>[0]["mutationLock"],
    todoCache: ConstructorParameters<typeof UpdateTodoItem>[0]["todoCache"],
  ) =>
    new UpdateTodoItem({
      todoRepository,
      todoReadRepository,
      unitOfWork,
      mutationLock,
      todoCache,
      logger: new Logger(UpdateTodoItem.name),
    }),
};

export const updateTodoScheduleProvider: FactoryProvider<UpdateTodoSchedule> = {
  provide: UpdateTodoSchedule,
  inject: [
    TODO_REPOSITORY,
    TODO_READ_REPOSITORY,
    UNIT_OF_WORK,
    MUTATION_LOCK,
    TODO_CACHE,
    DOMAIN_EVENT_PUBLISHER,
    TodoTimezoneResolver,
  ],
  useFactory: (
    todoRepository: ConstructorParameters<typeof UpdateTodoSchedule>[0]["todoRepository"],
    todoReadRepository: ConstructorParameters<typeof UpdateTodoSchedule>[0]["todoReadRepository"],
    unitOfWork: ConstructorParameters<typeof UpdateTodoSchedule>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof UpdateTodoSchedule>[0]["mutationLock"],
    todoCache: ConstructorParameters<typeof UpdateTodoSchedule>[0]["todoCache"],
    eventPublisher: ConstructorParameters<typeof UpdateTodoSchedule>[0]["eventPublisher"],
    timezoneResolver: ConstructorParameters<typeof UpdateTodoSchedule>[0]["timezoneResolver"],
  ) =>
    new UpdateTodoSchedule({
      todoRepository,
      todoReadRepository,
      unitOfWork,
      mutationLock,
      todoCache,
      eventPublisher,
      timezoneResolver,
      logger: new Logger(UpdateTodoSchedule.name),
    }),
};

export const updateTodoTitleProvider: FactoryProvider<UpdateTodoTitle> = {
  provide: UpdateTodoTitle,
  inject: [
    TODO_REPOSITORY,
    TODO_READ_REPOSITORY,
    UNIT_OF_WORK,
    MUTATION_LOCK,
    TODO_CACHE,
    DOMAIN_EVENT_PUBLISHER,
  ],
  useFactory: (
    todoRepository: ConstructorParameters<typeof UpdateTodoTitle>[0]["todoRepository"],
    todoReadRepository: ConstructorParameters<typeof UpdateTodoTitle>[0]["todoReadRepository"],
    unitOfWork: ConstructorParameters<typeof UpdateTodoTitle>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof UpdateTodoTitle>[0]["mutationLock"],
    todoCache: ConstructorParameters<typeof UpdateTodoTitle>[0]["todoCache"],
    eventPublisher: ConstructorParameters<typeof UpdateTodoTitle>[0]["eventPublisher"],
  ) =>
    new UpdateTodoTitle({
      todoRepository,
      todoReadRepository,
      unitOfWork,
      mutationLock,
      todoCache,
      eventPublisher,
      logger: new Logger(UpdateTodoTitle.name),
    }),
};

export const updateTodoVisibilityProvider: FactoryProvider<UpdateTodoVisibility> = {
  provide: UpdateTodoVisibility,
  inject: [
    TODO_REPOSITORY,
    TODO_READ_REPOSITORY,
    UNIT_OF_WORK,
    MUTATION_LOCK,
    TODO_CACHE,
    DOMAIN_EVENT_PUBLISHER,
  ],
  useFactory: (
    todoRepository: ConstructorParameters<typeof UpdateTodoVisibility>[0]["todoRepository"],
    todoReadRepository: ConstructorParameters<typeof UpdateTodoVisibility>[0]["todoReadRepository"],
    unitOfWork: ConstructorParameters<typeof UpdateTodoVisibility>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof UpdateTodoVisibility>[0]["mutationLock"],
    todoCache: ConstructorParameters<typeof UpdateTodoVisibility>[0]["todoCache"],
    eventPublisher: ConstructorParameters<typeof UpdateTodoVisibility>[0]["eventPublisher"],
  ) =>
    new UpdateTodoVisibility({
      todoRepository,
      todoReadRepository,
      unitOfWork,
      mutationLock,
      todoCache,
      eventPublisher,
      logger: new Logger(UpdateTodoVisibility.name),
    }),
};
