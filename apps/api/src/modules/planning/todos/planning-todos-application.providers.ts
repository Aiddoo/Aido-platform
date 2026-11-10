import { Logger, type FactoryProvider } from "@nestjs/common";

import { PaginationService } from "#api/shared/application/pagination/index";
import {
  UNIT_OF_WORK,
  DOMAIN_EVENT_PUBLISHER,
  MUTATION_LOCK,
} from "#api/shared/application/ports/index";
import { OPERATIONAL_ALERT } from "#api/shared/application/ports/operational-alert.port";

import { TODO_SERIES_OWNER } from "../todo-series/application/ports/todo-series-owner.port.js";
import { TODO_SERIES_REPOSITORY } from "../todo-series/application/ports/todo-series.repository.port.js";
import { CatchUpTodoSeriesUseCase } from "../todo-series/application/use-cases/catch-up-todo-series.use-case.js";
import { GetTodoSeriesUseCase } from "../todo-series/application/use-cases/get-todo-series.use-case.js";
import { MaterializeDueTodoSeriesUseCase } from "../todo-series/application/use-cases/materialize-due-todo-series.use-case.js";
import { MaterializeTodoOccurrencesUseCase } from "../todo-series/application/use-cases/materialize-todo-occurrences.use-case.js";
import { MaterializeTodoSeriesUseCase } from "../todo-series/application/use-cases/materialize-todo-series.use-case.js";
import { PublishTodoCreationUseCase } from "../todo-series/application/use-cases/publish-todo-creation.use-case.js";
import { PublishTodoSeriesEditUseCase } from "../todo-series/application/use-cases/publish-todo-series-edit.use-case.js";
import { StartSeriesFromTodoUseCase } from "../todo-series/application/use-cases/start-series-from-todo.use-case.js";
import { StopTodoSeriesUseCase } from "../todo-series/application/use-cases/stop-todo-series.use-case.js";
import { UpdateFollowingTodosUseCase } from "../todo-series/application/use-cases/update-following-todos.use-case.js";
import { CATEGORY_OWNERSHIP } from "./application/ports/category-ownership.port.js";
import { FRIEND_PORT } from "./application/ports/friend.port.js";
import { STREAK_PORT } from "./application/ports/streak.port.js";
import { TODO_CACHE } from "./application/ports/todo-cache.port.js";
import { TODO_OWNER_TIMEZONE } from "./application/ports/todo-owner-timezone.port.js";
import { TODO_READ_REPOSITORY } from "./application/ports/todo-read.repository.port.js";
import { TODO_REMINDER } from "./application/ports/todo-reminder-scheduler.port.js";
import { TODO_REPOSITORY } from "./application/ports/todo.repository.port.js";
import { AddTodoItemUseCase } from "./application/use-cases/add-todo-item.use-case.js";
import { ChangeTodoCategoryUseCase } from "./application/use-cases/change-todo-category.use-case.js";
import { CreateTodoUseCase } from "./application/use-cases/create-todo.use-case.js";
import { DeleteTodoItemUseCase } from "./application/use-cases/delete-todo-item.use-case.js";
import { DeleteTodoUseCase } from "./application/use-cases/delete-todo.use-case.js";
import { EditTodoUseCase } from "./application/use-cases/edit-todo.use-case.js";
import { GetTodoResourceLimitUseCase } from "./application/use-cases/get-todo-resource-limit.use-case.js";
import { GetTodoSummaryUseCase } from "./application/use-cases/get-todo-summary.use-case.js";
import { GetTodoUseCase } from "./application/use-cases/get-todo.use-case.js";
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

export const todoTimezoneResolverProvider: FactoryProvider<ResolveTodoTimezoneUseCase> = {
  provide: ResolveTodoTimezoneUseCase,
  inject: [TODO_OWNER_TIMEZONE],
  useFactory: (
    ownerTimezone: ConstructorParameters<typeof ResolveTodoTimezoneUseCase>[0]["ownerTimezone"],
  ) => new ResolveTodoTimezoneUseCase({ ownerTimezone }),
};

export const rebaseTodoTimezoneProvider: FactoryProvider<RebaseTodoTimezoneUseCase> = {
  provide: RebaseTodoTimezoneUseCase,
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
    todoRepository: ConstructorParameters<typeof RebaseTodoTimezoneUseCase>[0]["todoRepository"],
    seriesRepository: ConstructorParameters<
      typeof RebaseTodoTimezoneUseCase
    >[0]["seriesRepository"],
    ownerTimezone: ConstructorParameters<typeof RebaseTodoTimezoneUseCase>[0]["ownerTimezone"],
    todoReminder: ConstructorParameters<typeof RebaseTodoTimezoneUseCase>[0]["todoReminder"],
    todoCache: ConstructorParameters<typeof RebaseTodoTimezoneUseCase>[0]["todoCache"],
    unitOfWork: ConstructorParameters<typeof RebaseTodoTimezoneUseCase>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof RebaseTodoTimezoneUseCase>[0]["mutationLock"],
  ) =>
    new RebaseTodoTimezoneUseCase({
      todoRepository,
      seriesRepository,
      ownerTimezone,
      todoReminder,
      todoCache,
      unitOfWork,
      mutationLock,
      logger: new Logger(RebaseTodoTimezoneUseCase.name),
    }),
};

export const todoSeriesDueRunnerProvider: FactoryProvider<MaterializeTodoSeriesUseCase> = {
  provide: MaterializeTodoSeriesUseCase,
  inject: [
    TODO_SERIES_REPOSITORY,
    MaterializeTodoOccurrencesUseCase,
    PublishTodoCreationUseCase,
    UNIT_OF_WORK,
    MUTATION_LOCK,
  ],
  useFactory: (
    seriesRepository: ConstructorParameters<
      typeof MaterializeTodoSeriesUseCase
    >[0]["seriesRepository"],
    materializer: ConstructorParameters<typeof MaterializeTodoSeriesUseCase>[0]["materializer"],
    effects: ConstructorParameters<typeof MaterializeTodoSeriesUseCase>[0]["effects"],
    unitOfWork: ConstructorParameters<typeof MaterializeTodoSeriesUseCase>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof MaterializeTodoSeriesUseCase>[0]["mutationLock"],
  ) =>
    new MaterializeTodoSeriesUseCase({
      seriesRepository,
      materializer,
      effects,
      unitOfWork,
      mutationLock,
    }),
};

export const todoSeriesCatchUpProvider: FactoryProvider<CatchUpTodoSeriesUseCase> = {
  provide: CatchUpTodoSeriesUseCase,
  inject: [TODO_SERIES_REPOSITORY, TODO_SERIES_OWNER, MaterializeTodoSeriesUseCase],
  useFactory: (
    seriesRepository: ConstructorParameters<typeof CatchUpTodoSeriesUseCase>[0]["seriesRepository"],
    seriesOwner: ConstructorParameters<typeof CatchUpTodoSeriesUseCase>[0]["seriesOwner"],
    dueRunner: ConstructorParameters<typeof CatchUpTodoSeriesUseCase>[0]["dueRunner"],
  ) =>
    new CatchUpTodoSeriesUseCase({
      seriesRepository,
      seriesOwner,
      dueRunner,
      logger: new Logger(CatchUpTodoSeriesUseCase.name),
    }),
};

export const materializeDueTodoSeriesProvider: FactoryProvider<MaterializeDueTodoSeriesUseCase> = {
  provide: MaterializeDueTodoSeriesUseCase,
  inject: [
    TODO_SERIES_REPOSITORY,
    TODO_SERIES_OWNER,
    MaterializeTodoSeriesUseCase,
    OPERATIONAL_ALERT,
  ],
  useFactory: (
    seriesRepository: ConstructorParameters<
      typeof MaterializeDueTodoSeriesUseCase
    >[0]["seriesRepository"],
    seriesOwner: ConstructorParameters<typeof MaterializeDueTodoSeriesUseCase>[0]["seriesOwner"],
    dueRunner: ConstructorParameters<typeof MaterializeDueTodoSeriesUseCase>[0]["dueRunner"],
    alert: ConstructorParameters<typeof MaterializeDueTodoSeriesUseCase>[0]["alert"],
  ) =>
    new MaterializeDueTodoSeriesUseCase({
      seriesRepository,
      seriesOwner,
      dueRunner,
      alert,
      logger: new Logger(MaterializeDueTodoSeriesUseCase.name),
    }),
};

export const getFriendTodosProvider: FactoryProvider<ListFriendTodosUseCase> = {
  provide: ListFriendTodosUseCase,
  inject: [TODO_READ_REPOSITORY, PaginationService, FRIEND_PORT, TODO_CACHE],
  useFactory: (
    todoReadRepository: ConstructorParameters<
      typeof ListFriendTodosUseCase
    >[0]["todoReadRepository"],
    paginationService: ConstructorParameters<typeof ListFriendTodosUseCase>[0]["paginationService"],
    friendPort: ConstructorParameters<typeof ListFriendTodosUseCase>[0]["friendPort"],
    todoCache: ConstructorParameters<typeof ListFriendTodosUseCase>[0]["todoCache"],
  ) =>
    new ListFriendTodosUseCase({
      todoReadRepository,
      paginationService,
      friendPort,
      todoCache,
    }),
};

export const getTodoByIdProvider: FactoryProvider<GetTodoUseCase> = {
  provide: GetTodoUseCase,
  inject: [TODO_READ_REPOSITORY],
  useFactory: (
    todoReadRepository: ConstructorParameters<typeof GetTodoUseCase>[0]["todoReadRepository"],
  ) => new GetTodoUseCase({ todoReadRepository }),
};

export const getTodoResourceLimitProvider: FactoryProvider<GetTodoResourceLimitUseCase> = {
  provide: GetTodoResourceLimitUseCase,
  inject: [TODO_READ_REPOSITORY],
  useFactory: (
    todoReadRepository: ConstructorParameters<
      typeof GetTodoResourceLimitUseCase
    >[0]["todoReadRepository"],
  ) => new GetTodoResourceLimitUseCase({ todoReadRepository }),
};

export const getTodoSummaryProvider: FactoryProvider<GetTodoSummaryUseCase> = {
  provide: GetTodoSummaryUseCase,
  inject: [TODO_READ_REPOSITORY, STREAK_PORT, CatchUpTodoSeriesUseCase],
  useFactory: (
    todoReadRepository: ConstructorParameters<
      typeof GetTodoSummaryUseCase
    >[0]["todoReadRepository"],
    streakPort: ConstructorParameters<typeof GetTodoSummaryUseCase>[0]["streakPort"],
    seriesCatchUp: ConstructorParameters<typeof GetTodoSummaryUseCase>[0]["seriesCatchUp"],
  ) => new GetTodoSummaryUseCase({ todoReadRepository, streakPort, seriesCatchUp }),
};

export const getTodosProvider: FactoryProvider<ListTodosUseCase> = {
  provide: ListTodosUseCase,
  inject: [TODO_READ_REPOSITORY, PaginationService, CatchUpTodoSeriesUseCase],
  useFactory: (
    todoReadRepository: ConstructorParameters<typeof ListTodosUseCase>[0]["todoReadRepository"],
    paginationService: ConstructorParameters<typeof ListTodosUseCase>[0]["paginationService"],
    seriesCatchUp: ConstructorParameters<typeof ListTodosUseCase>[0]["seriesCatchUp"],
  ) =>
    new ListTodosUseCase({
      todoReadRepository,
      paginationService,
      seriesCatchUp,
    }),
};

export const addTodoItemProvider: FactoryProvider<AddTodoItemUseCase> = {
  provide: AddTodoItemUseCase,
  inject: [
    TODO_REPOSITORY,
    TODO_READ_REPOSITORY,
    UNIT_OF_WORK,
    MUTATION_LOCK,
    TODO_CACHE,
    DOMAIN_EVENT_PUBLISHER,
  ],
  useFactory: (
    todoRepository: ConstructorParameters<typeof AddTodoItemUseCase>[0]["todoRepository"],
    todoReadRepository: ConstructorParameters<typeof AddTodoItemUseCase>[0]["todoReadRepository"],
    unitOfWork: ConstructorParameters<typeof AddTodoItemUseCase>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof AddTodoItemUseCase>[0]["mutationLock"],
    todoCache: ConstructorParameters<typeof AddTodoItemUseCase>[0]["todoCache"],
    eventPublisher: ConstructorParameters<typeof AddTodoItemUseCase>[0]["eventPublisher"],
  ) =>
    new AddTodoItemUseCase({
      todoRepository,
      todoReadRepository,
      unitOfWork,
      mutationLock,
      todoCache,
      eventPublisher,
      logger: new Logger(AddTodoItemUseCase.name),
    }),
};

export const changeTodoCategoryProvider: FactoryProvider<ChangeTodoCategoryUseCase> = {
  provide: ChangeTodoCategoryUseCase,
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
    todoRepository: ConstructorParameters<typeof ChangeTodoCategoryUseCase>[0]["todoRepository"],
    todoReadRepository: ConstructorParameters<
      typeof ChangeTodoCategoryUseCase
    >[0]["todoReadRepository"],
    unitOfWork: ConstructorParameters<typeof ChangeTodoCategoryUseCase>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof ChangeTodoCategoryUseCase>[0]["mutationLock"],
    categoryOwnership: ConstructorParameters<
      typeof ChangeTodoCategoryUseCase
    >[0]["categoryOwnership"],
    todoCache: ConstructorParameters<typeof ChangeTodoCategoryUseCase>[0]["todoCache"],
    eventPublisher: ConstructorParameters<typeof ChangeTodoCategoryUseCase>[0]["eventPublisher"],
  ) =>
    new ChangeTodoCategoryUseCase({
      todoRepository,
      todoReadRepository,
      unitOfWork,
      mutationLock,
      categoryOwnership,
      todoCache,
      eventPublisher,
      logger: new Logger(ChangeTodoCategoryUseCase.name),
    }),
};

export const todoOccurrenceMaterializerProvider: FactoryProvider<MaterializeTodoOccurrencesUseCase> =
  {
    provide: MaterializeTodoOccurrencesUseCase,
    inject: [TODO_REPOSITORY, TODO_REMINDER],
    useFactory: (
      todoRepository: ConstructorParameters<
        typeof MaterializeTodoOccurrencesUseCase
      >[0]["todoRepository"],
      todoReminder: ConstructorParameters<
        typeof MaterializeTodoOccurrencesUseCase
      >[0]["todoReminder"],
    ) => new MaterializeTodoOccurrencesUseCase({ todoRepository, todoReminder }),
  };

export const todoCreationWriterProvider: FactoryProvider<WriteTodoCreationUseCase> = {
  provide: WriteTodoCreationUseCase,
  inject: [
    TODO_REPOSITORY,
    TODO_SERIES_REPOSITORY,
    MaterializeTodoOccurrencesUseCase,
    CATEGORY_OWNERSHIP,
  ],
  useFactory: (
    todoRepository: ConstructorParameters<typeof WriteTodoCreationUseCase>[0]["todoRepository"],
    todoSeriesRepository: ConstructorParameters<
      typeof WriteTodoCreationUseCase
    >[0]["todoSeriesRepository"],
    occurrenceMaterializer: ConstructorParameters<
      typeof WriteTodoCreationUseCase
    >[0]["occurrenceMaterializer"],
    categoryOwnership: ConstructorParameters<
      typeof WriteTodoCreationUseCase
    >[0]["categoryOwnership"],
  ) =>
    new WriteTodoCreationUseCase({
      todoRepository,
      todoSeriesRepository,
      occurrenceMaterializer,
      categoryOwnership,
    }),
};

export const todoCreationEffectsProvider: FactoryProvider<PublishTodoCreationUseCase> = {
  provide: PublishTodoCreationUseCase,
  inject: [TODO_CACHE, DOMAIN_EVENT_PUBLISHER],
  useFactory: (
    todoCache: ConstructorParameters<typeof PublishTodoCreationUseCase>[0]["todoCache"],
    eventPublisher: ConstructorParameters<typeof PublishTodoCreationUseCase>[0]["eventPublisher"],
  ) =>
    new PublishTodoCreationUseCase({
      todoCache,
      eventPublisher,
      logger: new Logger(PublishTodoCreationUseCase.name),
    }),
};

export const stagedTodoCreatorProvider: FactoryProvider<StageTodoCreationUseCase> = {
  provide: StageTodoCreationUseCase,
  inject: [
    WriteTodoCreationUseCase,
    PublishTodoCreationUseCase,
    TODO_READ_REPOSITORY,
    ResolveTodoTimezoneUseCase,
  ],
  useFactory: (
    writer: ConstructorParameters<typeof StageTodoCreationUseCase>[0]["writer"],
    effects: ConstructorParameters<typeof StageTodoCreationUseCase>[0]["effects"],
    todoReadRepository: ConstructorParameters<
      typeof StageTodoCreationUseCase
    >[0]["todoReadRepository"],
    timezoneResolver: ConstructorParameters<typeof StageTodoCreationUseCase>[0]["timezoneResolver"],
  ) => new StageTodoCreationUseCase({ writer, effects, todoReadRepository, timezoneResolver }),
};

export const createTodoProvider: FactoryProvider<CreateTodoUseCase> = {
  provide: CreateTodoUseCase,
  inject: [StageTodoCreationUseCase, UNIT_OF_WORK, MUTATION_LOCK],
  useFactory: (
    todoCreator: ConstructorParameters<typeof CreateTodoUseCase>[0]["todoCreator"],
    unitOfWork: ConstructorParameters<typeof CreateTodoUseCase>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof CreateTodoUseCase>[0]["mutationLock"],
  ) => new CreateTodoUseCase({ todoCreator, unitOfWork, mutationLock }),
};

export const deleteTodoProvider: FactoryProvider<DeleteTodoUseCase> = {
  provide: DeleteTodoUseCase,
  inject: [
    TODO_REPOSITORY,
    TODO_SERIES_REPOSITORY,
    PublishTodoSeriesEditUseCase,
    TODO_REMINDER,
    TODO_CACHE,
    UNIT_OF_WORK,
    MUTATION_LOCK,
    DOMAIN_EVENT_PUBLISHER,
  ],
  useFactory: (
    todoRepository: ConstructorParameters<typeof DeleteTodoUseCase>[0]["todoRepository"],
    seriesRepository: ConstructorParameters<typeof DeleteTodoUseCase>[0]["seriesRepository"],
    seriesEffects: ConstructorParameters<typeof DeleteTodoUseCase>[0]["seriesEffects"],
    todoReminder: ConstructorParameters<typeof DeleteTodoUseCase>[0]["todoReminder"],
    todoCache: ConstructorParameters<typeof DeleteTodoUseCase>[0]["todoCache"],
    unitOfWork: ConstructorParameters<typeof DeleteTodoUseCase>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof DeleteTodoUseCase>[0]["mutationLock"],
    eventPublisher: ConstructorParameters<typeof DeleteTodoUseCase>[0]["eventPublisher"],
  ) =>
    new DeleteTodoUseCase({
      todoRepository,
      seriesRepository,
      seriesEffects,
      todoReminder,
      todoCache,
      unitOfWork,
      mutationLock,
      eventPublisher,
      logger: new Logger(DeleteTodoUseCase.name),
    }),
};

export const todoSeriesEditEffectsProvider: FactoryProvider<PublishTodoSeriesEditUseCase> = {
  provide: PublishTodoSeriesEditUseCase,
  inject: [TODO_CACHE, DOMAIN_EVENT_PUBLISHER],
  useFactory: (
    todoCache: ConstructorParameters<typeof PublishTodoSeriesEditUseCase>[0]["todoCache"],
    eventPublisher: ConstructorParameters<typeof PublishTodoSeriesEditUseCase>[0]["eventPublisher"],
  ) =>
    new PublishTodoSeriesEditUseCase({
      todoCache,
      eventPublisher,
      logger: new Logger(PublishTodoSeriesEditUseCase.name),
    }),
};

export const getTodoSeriesProvider: FactoryProvider<GetTodoSeriesUseCase> = {
  provide: GetTodoSeriesUseCase,
  inject: [TODO_SERIES_REPOSITORY],
  useFactory: (
    seriesRepository: ConstructorParameters<typeof GetTodoSeriesUseCase>[0]["seriesRepository"],
  ) => new GetTodoSeriesUseCase({ seriesRepository }),
};

export const stopTodoSeriesProvider: FactoryProvider<StopTodoSeriesUseCase> = {
  provide: StopTodoSeriesUseCase,
  inject: [
    TODO_REPOSITORY,
    TODO_SERIES_REPOSITORY,
    TODO_REMINDER,
    PublishTodoSeriesEditUseCase,
    MUTATION_LOCK,
  ],
  useFactory: (
    todoRepository: ConstructorParameters<typeof StopTodoSeriesUseCase>[0]["todoRepository"],
    seriesRepository: ConstructorParameters<typeof StopTodoSeriesUseCase>[0]["seriesRepository"],
    todoReminder: ConstructorParameters<typeof StopTodoSeriesUseCase>[0]["todoReminder"],
    effects: ConstructorParameters<typeof StopTodoSeriesUseCase>[0]["effects"],
    mutationLock: ConstructorParameters<typeof StopTodoSeriesUseCase>[0]["mutationLock"],
  ) =>
    new StopTodoSeriesUseCase({
      todoRepository,
      seriesRepository,
      todoReminder,
      effects,
      mutationLock,
      logger: new Logger(StopTodoSeriesUseCase.name),
    }),
};

export const startSeriesFromTodoProvider: FactoryProvider<StartSeriesFromTodoUseCase> = {
  provide: StartSeriesFromTodoUseCase,
  inject: [
    TODO_REPOSITORY,
    TODO_SERIES_REPOSITORY,
    MaterializeTodoOccurrencesUseCase,
    TODO_REMINDER,
    PublishTodoCreationUseCase,
    MUTATION_LOCK,
  ],
  useFactory: (
    todoRepository: ConstructorParameters<typeof StartSeriesFromTodoUseCase>[0]["todoRepository"],
    seriesRepository: ConstructorParameters<
      typeof StartSeriesFromTodoUseCase
    >[0]["seriesRepository"],
    materializer: ConstructorParameters<typeof StartSeriesFromTodoUseCase>[0]["materializer"],
    todoReminder: ConstructorParameters<typeof StartSeriesFromTodoUseCase>[0]["todoReminder"],
    effects: ConstructorParameters<typeof StartSeriesFromTodoUseCase>[0]["effects"],
    mutationLock: ConstructorParameters<typeof StartSeriesFromTodoUseCase>[0]["mutationLock"],
  ) =>
    new StartSeriesFromTodoUseCase({
      todoRepository,
      seriesRepository,
      materializer,
      todoReminder,
      effects,
      mutationLock,
    }),
};

export const updateFollowingTodosProvider: FactoryProvider<UpdateFollowingTodosUseCase> = {
  provide: UpdateFollowingTodosUseCase,
  inject: [
    TODO_REPOSITORY,
    TODO_READ_REPOSITORY,
    TODO_SERIES_REPOSITORY,
    CATEGORY_OWNERSHIP,
    MaterializeTodoOccurrencesUseCase,
    TODO_REMINDER,
    PublishTodoSeriesEditUseCase,
    UNIT_OF_WORK,
    MUTATION_LOCK,
  ],
  useFactory: (
    todoRepository: ConstructorParameters<typeof UpdateFollowingTodosUseCase>[0]["todoRepository"],
    todoReadRepository: ConstructorParameters<
      typeof UpdateFollowingTodosUseCase
    >[0]["todoReadRepository"],
    seriesRepository: ConstructorParameters<
      typeof UpdateFollowingTodosUseCase
    >[0]["seriesRepository"],
    categoryOwnership: ConstructorParameters<
      typeof UpdateFollowingTodosUseCase
    >[0]["categoryOwnership"],
    materializer: ConstructorParameters<typeof UpdateFollowingTodosUseCase>[0]["materializer"],
    todoReminder: ConstructorParameters<typeof UpdateFollowingTodosUseCase>[0]["todoReminder"],
    effects: ConstructorParameters<typeof UpdateFollowingTodosUseCase>[0]["effects"],
    unitOfWork: ConstructorParameters<typeof UpdateFollowingTodosUseCase>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof UpdateFollowingTodosUseCase>[0]["mutationLock"],
  ) =>
    new UpdateFollowingTodosUseCase({
      todoRepository,
      todoReadRepository,
      seriesRepository,
      categoryOwnership,
      materializer,
      todoReminder,
      effects,
      unitOfWork,
      mutationLock,
      logger: new Logger(UpdateFollowingTodosUseCase.name),
    }),
};

export const deleteTodoItemProvider: FactoryProvider<DeleteTodoItemUseCase> = {
  provide: DeleteTodoItemUseCase,
  inject: [TODO_REPOSITORY, TODO_READ_REPOSITORY, UNIT_OF_WORK, MUTATION_LOCK, TODO_CACHE],
  useFactory: (
    todoRepository: ConstructorParameters<typeof DeleteTodoItemUseCase>[0]["todoRepository"],
    todoReadRepository: ConstructorParameters<
      typeof DeleteTodoItemUseCase
    >[0]["todoReadRepository"],
    unitOfWork: ConstructorParameters<typeof DeleteTodoItemUseCase>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof DeleteTodoItemUseCase>[0]["mutationLock"],
    todoCache: ConstructorParameters<typeof DeleteTodoItemUseCase>[0]["todoCache"],
  ) =>
    new DeleteTodoItemUseCase({
      todoRepository,
      todoReadRepository,
      unitOfWork,
      mutationLock,
      todoCache,
      logger: new Logger(DeleteTodoItemUseCase.name),
    }),
};

export const reorderTodoProvider: FactoryProvider<ReorderTodoUseCase> = {
  provide: ReorderTodoUseCase,
  inject: [TODO_REPOSITORY, TODO_READ_REPOSITORY, UNIT_OF_WORK, MUTATION_LOCK, TODO_CACHE],
  useFactory: (
    todoRepository: ConstructorParameters<typeof ReorderTodoUseCase>[0]["todoRepository"],
    todoReadRepository: ConstructorParameters<typeof ReorderTodoUseCase>[0]["todoReadRepository"],
    unitOfWork: ConstructorParameters<typeof ReorderTodoUseCase>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof ReorderTodoUseCase>[0]["mutationLock"],
    todoCache: ConstructorParameters<typeof ReorderTodoUseCase>[0]["todoCache"],
  ) =>
    new ReorderTodoUseCase({
      todoRepository,
      todoReadRepository,
      unitOfWork,
      mutationLock,
      todoCache,
      logger: new Logger(ReorderTodoUseCase.name),
    }),
};

export const reorderTodoItemsProvider: FactoryProvider<ReorderTodoItemsUseCase> = {
  provide: ReorderTodoItemsUseCase,
  inject: [TODO_REPOSITORY, TODO_READ_REPOSITORY, UNIT_OF_WORK, MUTATION_LOCK, TODO_CACHE],
  useFactory: (
    todoRepository: ConstructorParameters<typeof ReorderTodoItemsUseCase>[0]["todoRepository"],
    todoReadRepository: ConstructorParameters<
      typeof ReorderTodoItemsUseCase
    >[0]["todoReadRepository"],
    unitOfWork: ConstructorParameters<typeof ReorderTodoItemsUseCase>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof ReorderTodoItemsUseCase>[0]["mutationLock"],
    todoCache: ConstructorParameters<typeof ReorderTodoItemsUseCase>[0]["todoCache"],
  ) =>
    new ReorderTodoItemsUseCase({
      todoRepository,
      todoReadRepository,
      unitOfWork,
      mutationLock,
      todoCache,
      logger: new Logger(ReorderTodoItemsUseCase.name),
    }),
};

export const toggleTodoCompleteProvider: FactoryProvider<SetTodoCompletedUseCase> = {
  provide: SetTodoCompletedUseCase,
  inject: [
    TODO_REPOSITORY,
    TODO_READ_REPOSITORY,
    UNIT_OF_WORK,
    MUTATION_LOCK,
    TODO_CACHE,
    DOMAIN_EVENT_PUBLISHER,
  ],
  useFactory: (
    todoRepository: ConstructorParameters<typeof SetTodoCompletedUseCase>[0]["todoRepository"],
    todoReadRepository: ConstructorParameters<
      typeof SetTodoCompletedUseCase
    >[0]["todoReadRepository"],
    unitOfWork: ConstructorParameters<typeof SetTodoCompletedUseCase>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof SetTodoCompletedUseCase>[0]["mutationLock"],
    todoCache: ConstructorParameters<typeof SetTodoCompletedUseCase>[0]["todoCache"],
    eventPublisher: ConstructorParameters<typeof SetTodoCompletedUseCase>[0]["eventPublisher"],
  ) =>
    new SetTodoCompletedUseCase({
      todoRepository,
      todoReadRepository,
      unitOfWork,
      mutationLock,
      todoCache,
      eventPublisher,
      logger: new Logger(SetTodoCompletedUseCase.name),
    }),
};

export const editTodoProvider: FactoryProvider<EditTodoUseCase> = {
  provide: EditTodoUseCase,
  inject: [
    UpdateTodoUseCase,
    UpdateFollowingTodosUseCase,
    StartSeriesFromTodoUseCase,
    StopTodoSeriesUseCase,
    TODO_READ_REPOSITORY,
    UNIT_OF_WORK,
    MUTATION_LOCK,
    ResolveTodoTimezoneUseCase,
  ],
  useFactory: (
    updateTodo: ConstructorParameters<typeof EditTodoUseCase>[0]["updateTodo"],
    updateFollowingTodos: ConstructorParameters<typeof EditTodoUseCase>[0]["updateFollowingTodos"],
    startSeriesFromTodo: ConstructorParameters<typeof EditTodoUseCase>[0]["startSeriesFromTodo"],
    stopTodoSeries: ConstructorParameters<typeof EditTodoUseCase>[0]["stopTodoSeries"],
    todoReadRepository: ConstructorParameters<typeof EditTodoUseCase>[0]["todoReadRepository"],
    unitOfWork: ConstructorParameters<typeof EditTodoUseCase>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof EditTodoUseCase>[0]["mutationLock"],
    timezoneResolver: ConstructorParameters<typeof EditTodoUseCase>[0]["timezoneResolver"],
  ) =>
    new EditTodoUseCase({
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

export const updateTodoProvider: FactoryProvider<UpdateTodoUseCase> = {
  provide: UpdateTodoUseCase,
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
    todoRepository: ConstructorParameters<typeof UpdateTodoUseCase>[0]["todoRepository"],
    todoReadRepository: ConstructorParameters<typeof UpdateTodoUseCase>[0]["todoReadRepository"],
    unitOfWork: ConstructorParameters<typeof UpdateTodoUseCase>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof UpdateTodoUseCase>[0]["mutationLock"],
    categoryOwnership: ConstructorParameters<typeof UpdateTodoUseCase>[0]["categoryOwnership"],
    todoCache: ConstructorParameters<typeof UpdateTodoUseCase>[0]["todoCache"],
    eventPublisher: ConstructorParameters<typeof UpdateTodoUseCase>[0]["eventPublisher"],
  ) =>
    new UpdateTodoUseCase({
      todoRepository,
      todoReadRepository,
      unitOfWork,
      mutationLock,
      categoryOwnership,
      todoCache,
      eventPublisher,
      logger: new Logger(UpdateTodoUseCase.name),
    }),
};

export const updateTodoItemProvider: FactoryProvider<UpdateTodoItemUseCase> = {
  provide: UpdateTodoItemUseCase,
  inject: [TODO_REPOSITORY, TODO_READ_REPOSITORY, UNIT_OF_WORK, MUTATION_LOCK, TODO_CACHE],
  useFactory: (
    todoRepository: ConstructorParameters<typeof UpdateTodoItemUseCase>[0]["todoRepository"],
    todoReadRepository: ConstructorParameters<
      typeof UpdateTodoItemUseCase
    >[0]["todoReadRepository"],
    unitOfWork: ConstructorParameters<typeof UpdateTodoItemUseCase>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof UpdateTodoItemUseCase>[0]["mutationLock"],
    todoCache: ConstructorParameters<typeof UpdateTodoItemUseCase>[0]["todoCache"],
  ) =>
    new UpdateTodoItemUseCase({
      todoRepository,
      todoReadRepository,
      unitOfWork,
      mutationLock,
      todoCache,
      logger: new Logger(UpdateTodoItemUseCase.name),
    }),
};

export const updateTodoScheduleProvider: FactoryProvider<UpdateTodoScheduleUseCase> = {
  provide: UpdateTodoScheduleUseCase,
  inject: [
    TODO_REPOSITORY,
    TODO_READ_REPOSITORY,
    UNIT_OF_WORK,
    MUTATION_LOCK,
    TODO_CACHE,
    DOMAIN_EVENT_PUBLISHER,
    ResolveTodoTimezoneUseCase,
  ],
  useFactory: (
    todoRepository: ConstructorParameters<typeof UpdateTodoScheduleUseCase>[0]["todoRepository"],
    todoReadRepository: ConstructorParameters<
      typeof UpdateTodoScheduleUseCase
    >[0]["todoReadRepository"],
    unitOfWork: ConstructorParameters<typeof UpdateTodoScheduleUseCase>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof UpdateTodoScheduleUseCase>[0]["mutationLock"],
    todoCache: ConstructorParameters<typeof UpdateTodoScheduleUseCase>[0]["todoCache"],
    eventPublisher: ConstructorParameters<typeof UpdateTodoScheduleUseCase>[0]["eventPublisher"],
    timezoneResolver: ConstructorParameters<
      typeof UpdateTodoScheduleUseCase
    >[0]["timezoneResolver"],
  ) =>
    new UpdateTodoScheduleUseCase({
      todoRepository,
      todoReadRepository,
      unitOfWork,
      mutationLock,
      todoCache,
      eventPublisher,
      timezoneResolver,
      logger: new Logger(UpdateTodoScheduleUseCase.name),
    }),
};

export const updateTodoTitleProvider: FactoryProvider<UpdateTodoTitleUseCase> = {
  provide: UpdateTodoTitleUseCase,
  inject: [
    TODO_REPOSITORY,
    TODO_READ_REPOSITORY,
    UNIT_OF_WORK,
    MUTATION_LOCK,
    TODO_CACHE,
    DOMAIN_EVENT_PUBLISHER,
  ],
  useFactory: (
    todoRepository: ConstructorParameters<typeof UpdateTodoTitleUseCase>[0]["todoRepository"],
    todoReadRepository: ConstructorParameters<
      typeof UpdateTodoTitleUseCase
    >[0]["todoReadRepository"],
    unitOfWork: ConstructorParameters<typeof UpdateTodoTitleUseCase>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof UpdateTodoTitleUseCase>[0]["mutationLock"],
    todoCache: ConstructorParameters<typeof UpdateTodoTitleUseCase>[0]["todoCache"],
    eventPublisher: ConstructorParameters<typeof UpdateTodoTitleUseCase>[0]["eventPublisher"],
  ) =>
    new UpdateTodoTitleUseCase({
      todoRepository,
      todoReadRepository,
      unitOfWork,
      mutationLock,
      todoCache,
      eventPublisher,
      logger: new Logger(UpdateTodoTitleUseCase.name),
    }),
};

export const updateTodoVisibilityProvider: FactoryProvider<UpdateTodoVisibilityUseCase> = {
  provide: UpdateTodoVisibilityUseCase,
  inject: [
    TODO_REPOSITORY,
    TODO_READ_REPOSITORY,
    UNIT_OF_WORK,
    MUTATION_LOCK,
    TODO_CACHE,
    DOMAIN_EVENT_PUBLISHER,
  ],
  useFactory: (
    todoRepository: ConstructorParameters<typeof UpdateTodoVisibilityUseCase>[0]["todoRepository"],
    todoReadRepository: ConstructorParameters<
      typeof UpdateTodoVisibilityUseCase
    >[0]["todoReadRepository"],
    unitOfWork: ConstructorParameters<typeof UpdateTodoVisibilityUseCase>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof UpdateTodoVisibilityUseCase>[0]["mutationLock"],
    todoCache: ConstructorParameters<typeof UpdateTodoVisibilityUseCase>[0]["todoCache"],
    eventPublisher: ConstructorParameters<typeof UpdateTodoVisibilityUseCase>[0]["eventPublisher"],
  ) =>
    new UpdateTodoVisibilityUseCase({
      todoRepository,
      todoReadRepository,
      unitOfWork,
      mutationLock,
      todoCache,
      eventPublisher,
      logger: new Logger(UpdateTodoVisibilityUseCase.name),
    }),
};
