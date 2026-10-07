import { Logger, type FactoryProvider } from "@nestjs/common";

import { PaginationService } from "#api/shared/application/pagination/index";
import {
  UNIT_OF_WORK,
  DOMAIN_EVENT_PUBLISHER,
  MUTATION_LOCK,
} from "#api/shared/application/ports/index";

import { CATEGORY_OWNERSHIP } from "./application/ports/todos/category-ownership.port.js";
import { FRIEND_PORT } from "./application/ports/todos/friend.port.js";
import { STREAK_PORT } from "./application/ports/todos/streak.port.js";
import { TODO_CACHE } from "./application/ports/todos/todo-cache.port.js";
import { TODO_READ_REPOSITORY } from "./application/ports/todos/todo-read.repository.port.js";
import { TODO_REPOSITORY } from "./application/ports/todos/todo.repository.port.js";
import { StagedTodoCreator } from "./application/services/todos/staged-todo-creator.service.js";
import { TodoCreationEffects } from "./application/services/todos/todo-creation-effects.service.js";
import { TodoCreationWriter } from "./application/services/todos/todo-creation-writer.service.js";
import { AddTodoItem } from "./application/use-cases/todos/add-todo-item.use-case.js";
import { ChangeTodoCategory } from "./application/use-cases/todos/change-todo-category.use-case.js";
import { CreateRecurringTodos } from "./application/use-cases/todos/create-recurring-todos.use-case.js";
import { CreateTodo } from "./application/use-cases/todos/create-todo.use-case.js";
import { DeleteTodoItem } from "./application/use-cases/todos/delete-todo-item.use-case.js";
import { DeleteTodo } from "./application/use-cases/todos/delete-todo.use-case.js";
import { GetFriendTodos } from "./application/use-cases/todos/get-friend-todos.use-case.js";
import { GetTodoById } from "./application/use-cases/todos/get-todo-by-id.use-case.js";
import { GetTodoResourceLimit } from "./application/use-cases/todos/get-todo-resource-limit.use-case.js";
import { GetTodoSummary } from "./application/use-cases/todos/get-todo-summary.use-case.js";
import { GetTodos } from "./application/use-cases/todos/get-todos.use-case.js";
import { ReorderTodoItems } from "./application/use-cases/todos/reorder-todo-items.use-case.js";
import { ReorderTodo } from "./application/use-cases/todos/reorder-todo.use-case.js";
import { ToggleTodoComplete } from "./application/use-cases/todos/toggle-todo-complete.use-case.js";
import { UpdateTodoItem } from "./application/use-cases/todos/update-todo-item.use-case.js";
import { UpdateTodoSchedule } from "./application/use-cases/todos/update-todo-schedule.use-case.js";
import { UpdateTodoTitle } from "./application/use-cases/todos/update-todo-title.use-case.js";
import { UpdateTodoVisibility } from "./application/use-cases/todos/update-todo-visibility.use-case.js";
import { UpdateTodo } from "./application/use-cases/todos/update-todo.use-case.js";

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
  inject: [TODO_READ_REPOSITORY, STREAK_PORT],
  useFactory: (
    todoReadRepository: ConstructorParameters<typeof GetTodoSummary>[0]["todoReadRepository"],
    streakPort: ConstructorParameters<typeof GetTodoSummary>[0]["streakPort"],
  ) => new GetTodoSummary({ todoReadRepository, streakPort }),
};

export const getTodosProvider: FactoryProvider<GetTodos> = {
  provide: GetTodos,
  inject: [TODO_READ_REPOSITORY, PaginationService],
  useFactory: (
    todoReadRepository: ConstructorParameters<typeof GetTodos>[0]["todoReadRepository"],
    paginationService: ConstructorParameters<typeof GetTodos>[0]["paginationService"],
  ) =>
    new GetTodos({
      todoReadRepository,
      paginationService,
    }),
};

export const addTodoItemProvider: FactoryProvider<AddTodoItem> = {
  provide: AddTodoItem,
  inject: [TODO_REPOSITORY, TODO_READ_REPOSITORY, UNIT_OF_WORK, MUTATION_LOCK, TODO_CACHE],
  useFactory: (
    todoRepository: ConstructorParameters<typeof AddTodoItem>[0]["todoRepository"],
    todoReadRepository: ConstructorParameters<typeof AddTodoItem>[0]["todoReadRepository"],
    unitOfWork: ConstructorParameters<typeof AddTodoItem>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof AddTodoItem>[0]["mutationLock"],
    todoCache: ConstructorParameters<typeof AddTodoItem>[0]["todoCache"],
  ) =>
    new AddTodoItem({
      todoRepository,
      todoReadRepository,
      unitOfWork,
      mutationLock,
      todoCache,
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

export const todoCreationWriterProvider: FactoryProvider<TodoCreationWriter> = {
  provide: TodoCreationWriter,
  inject: [TODO_REPOSITORY, CATEGORY_OWNERSHIP],
  useFactory: (
    todoRepository: ConstructorParameters<typeof TodoCreationWriter>[0]["todoRepository"],
    categoryOwnership: ConstructorParameters<typeof TodoCreationWriter>[0]["categoryOwnership"],
  ) => new TodoCreationWriter({ todoRepository, categoryOwnership }),
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
  inject: [TodoCreationWriter, TodoCreationEffects, TODO_READ_REPOSITORY],
  useFactory: (
    writer: ConstructorParameters<typeof StagedTodoCreator>[0]["writer"],
    effects: ConstructorParameters<typeof StagedTodoCreator>[0]["effects"],
    todoReadRepository: ConstructorParameters<typeof StagedTodoCreator>[0]["todoReadRepository"],
  ) => new StagedTodoCreator({ writer, effects, todoReadRepository }),
};

export const createRecurringTodosProvider: FactoryProvider<CreateRecurringTodos> = {
  provide: CreateRecurringTodos,
  inject: [
    TodoCreationWriter,
    TodoCreationEffects,
    TODO_READ_REPOSITORY,
    UNIT_OF_WORK,
    MUTATION_LOCK,
  ],
  useFactory: (
    writer: ConstructorParameters<typeof CreateRecurringTodos>[0]["writer"],
    effects: ConstructorParameters<typeof CreateRecurringTodos>[0]["effects"],
    todoReadRepository: ConstructorParameters<typeof CreateRecurringTodos>[0]["todoReadRepository"],
    unitOfWork: ConstructorParameters<typeof CreateRecurringTodos>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof CreateRecurringTodos>[0]["mutationLock"],
  ) => new CreateRecurringTodos({ writer, effects, todoReadRepository, unitOfWork, mutationLock }),
};

export const createTodoProvider: FactoryProvider<CreateTodo> = {
  provide: CreateTodo,
  inject: [
    TodoCreationWriter,
    TodoCreationEffects,
    TODO_READ_REPOSITORY,
    UNIT_OF_WORK,
    MUTATION_LOCK,
  ],
  useFactory: (
    writer: ConstructorParameters<typeof CreateTodo>[0]["writer"],
    effects: ConstructorParameters<typeof CreateTodo>[0]["effects"],
    todoReadRepository: ConstructorParameters<typeof CreateTodo>[0]["todoReadRepository"],
    unitOfWork: ConstructorParameters<typeof CreateTodo>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof CreateTodo>[0]["mutationLock"],
  ) => new CreateTodo({ writer, effects, todoReadRepository, unitOfWork, mutationLock }),
};

export const deleteTodoProvider: FactoryProvider<DeleteTodo> = {
  provide: DeleteTodo,
  inject: [TODO_REPOSITORY, TODO_CACHE, UNIT_OF_WORK, MUTATION_LOCK, DOMAIN_EVENT_PUBLISHER],
  useFactory: (
    todoRepository: ConstructorParameters<typeof DeleteTodo>[0]["todoRepository"],
    todoCache: ConstructorParameters<typeof DeleteTodo>[0]["todoCache"],
    unitOfWork: ConstructorParameters<typeof DeleteTodo>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof DeleteTodo>[0]["mutationLock"],
    eventPublisher: ConstructorParameters<typeof DeleteTodo>[0]["eventPublisher"],
  ) =>
    new DeleteTodo({
      todoRepository,
      todoCache,
      unitOfWork,
      mutationLock,
      eventPublisher,
      logger: new Logger(DeleteTodo.name),
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
  ],
  useFactory: (
    todoRepository: ConstructorParameters<typeof UpdateTodoSchedule>[0]["todoRepository"],
    todoReadRepository: ConstructorParameters<typeof UpdateTodoSchedule>[0]["todoReadRepository"],
    unitOfWork: ConstructorParameters<typeof UpdateTodoSchedule>[0]["unitOfWork"],
    mutationLock: ConstructorParameters<typeof UpdateTodoSchedule>[0]["mutationLock"],
    todoCache: ConstructorParameters<typeof UpdateTodoSchedule>[0]["todoCache"],
    eventPublisher: ConstructorParameters<typeof UpdateTodoSchedule>[0]["eventPublisher"],
  ) =>
    new UpdateTodoSchedule({
      todoRepository,
      todoReadRepository,
      unitOfWork,
      mutationLock,
      todoCache,
      eventPublisher,
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
