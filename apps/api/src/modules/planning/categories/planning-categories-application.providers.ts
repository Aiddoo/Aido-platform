import { Logger, type FactoryProvider } from "@nestjs/common";

import { ENTITLEMENT_READER } from "#api/modules/access/access-entitlement.public";
import {
  DOMAIN_EVENT_PUBLISHER,
  MUTATION_LOCK,
  UNIT_OF_WORK,
} from "#api/shared/application/ports/index";

import { TODO_CATEGORY_CACHE } from "./application/ports/todo-category-cache.port.js";
import { TODO_CATEGORY_LIMIT_READER } from "./application/ports/todo-category-limit.reader.port.js";
import { TODO_CATEGORY_REPOSITORY } from "./application/ports/todo-category.repository.port.js";
import { CreateTodoCategoryUseCase } from "./application/use-cases/create-todo-category.use-case.js";
import { DeleteTodoCategoryUseCase } from "./application/use-cases/delete-todo-category.use-case.js";
import { GetTodoCategoryResourceLimitUseCase } from "./application/use-cases/get-todo-category-resource-limit.use-case.js";
import { GetTodoCategoryUseCase } from "./application/use-cases/get-todo-category.use-case.js";
import { ListTodoCategoriesUseCase } from "./application/use-cases/list-todo-categories.use-case.js";
import { ReorderTodoCategoryUseCase } from "./application/use-cases/reorder-todo-category.use-case.js";
import { UpdateTodoCategoryUseCase } from "./application/use-cases/update-todo-category.use-case.js";
import { TodoCategoryReaderAdapter } from "./infrastructure/adapters/todo-category-reader.adapter.js";

export const todoCategoryReaderProvider: FactoryProvider<TodoCategoryReaderAdapter> = {
  provide: TodoCategoryReaderAdapter,
  inject: [TODO_CATEGORY_REPOSITORY],
  useFactory: (
    repository: ConstructorParameters<typeof TodoCategoryReaderAdapter>[0]["repository"],
  ) => new TodoCategoryReaderAdapter({ repository }),
};

export const getTodoCategoriesProvider: FactoryProvider<ListTodoCategoriesUseCase> = {
  provide: ListTodoCategoriesUseCase,
  inject: [TODO_CATEGORY_REPOSITORY, TODO_CATEGORY_CACHE],
  useFactory: (
    repository: ConstructorParameters<typeof ListTodoCategoriesUseCase>[0]["repository"],
    cache: ConstructorParameters<typeof ListTodoCategoriesUseCase>[0]["cache"],
  ) => new ListTodoCategoriesUseCase({ repository, cache }),
};

export const getTodoCategoryProvider: FactoryProvider<GetTodoCategoryUseCase> = {
  provide: GetTodoCategoryUseCase,
  inject: [TODO_CATEGORY_REPOSITORY],
  useFactory: (repository: ConstructorParameters<typeof GetTodoCategoryUseCase>[0]["repository"]) =>
    new GetTodoCategoryUseCase({ repository }),
};

export const getTodoCategoryResourceLimitProvider: FactoryProvider<GetTodoCategoryResourceLimitUseCase> =
  {
    provide: GetTodoCategoryResourceLimitUseCase,
    inject: [TODO_CATEGORY_REPOSITORY, ENTITLEMENT_READER],
    useFactory: (
      repository: ConstructorParameters<
        typeof GetTodoCategoryResourceLimitUseCase
      >[0]["repository"],
      entitlementReader: ConstructorParameters<
        typeof GetTodoCategoryResourceLimitUseCase
      >[0]["entitlementReader"],
    ) => new GetTodoCategoryResourceLimitUseCase({ repository, entitlementReader }),
  };

export const createTodoCategoryProvider: FactoryProvider<CreateTodoCategoryUseCase> = {
  provide: CreateTodoCategoryUseCase,
  inject: [
    TODO_CATEGORY_REPOSITORY,
    TODO_CATEGORY_CACHE,
    TODO_CATEGORY_LIMIT_READER,
    MUTATION_LOCK,
    UNIT_OF_WORK,
  ],
  useFactory: (
    repository: ConstructorParameters<typeof CreateTodoCategoryUseCase>[0]["repository"],
    cache: ConstructorParameters<typeof CreateTodoCategoryUseCase>[0]["cache"],
    limitReader: ConstructorParameters<typeof CreateTodoCategoryUseCase>[0]["limitReader"],
    mutationLock: ConstructorParameters<typeof CreateTodoCategoryUseCase>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof CreateTodoCategoryUseCase>[0]["unitOfWork"],
  ) =>
    new CreateTodoCategoryUseCase({
      repository,
      cache,
      limitReader,
      mutationLock,
      unitOfWork,
      logger: new Logger(CreateTodoCategoryUseCase.name),
    }),
};

export const deleteTodoCategoryProvider: FactoryProvider<DeleteTodoCategoryUseCase> = {
  provide: DeleteTodoCategoryUseCase,
  inject: [
    TODO_CATEGORY_REPOSITORY,
    TODO_CATEGORY_CACHE,
    MUTATION_LOCK,
    UNIT_OF_WORK,
    DOMAIN_EVENT_PUBLISHER,
  ],
  useFactory: (
    repository: ConstructorParameters<typeof DeleteTodoCategoryUseCase>[0]["repository"],
    cache: ConstructorParameters<typeof DeleteTodoCategoryUseCase>[0]["cache"],
    mutationLock: ConstructorParameters<typeof DeleteTodoCategoryUseCase>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof DeleteTodoCategoryUseCase>[0]["unitOfWork"],
    eventPublisher: ConstructorParameters<typeof DeleteTodoCategoryUseCase>[0]["eventPublisher"],
  ) =>
    new DeleteTodoCategoryUseCase({
      repository,
      cache,
      mutationLock,
      unitOfWork,
      eventPublisher,
      logger: new Logger(DeleteTodoCategoryUseCase.name),
    }),
};

export const reorderTodoCategoryProvider: FactoryProvider<ReorderTodoCategoryUseCase> = {
  provide: ReorderTodoCategoryUseCase,
  inject: [TODO_CATEGORY_REPOSITORY, TODO_CATEGORY_CACHE, MUTATION_LOCK, UNIT_OF_WORK],
  useFactory: (
    repository: ConstructorParameters<typeof ReorderTodoCategoryUseCase>[0]["repository"],
    cache: ConstructorParameters<typeof ReorderTodoCategoryUseCase>[0]["cache"],
    mutationLock: ConstructorParameters<typeof ReorderTodoCategoryUseCase>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof ReorderTodoCategoryUseCase>[0]["unitOfWork"],
  ) =>
    new ReorderTodoCategoryUseCase({
      repository,
      cache,
      mutationLock,
      unitOfWork,
      logger: new Logger(ReorderTodoCategoryUseCase.name),
    }),
};

export const updateTodoCategoryProvider: FactoryProvider<UpdateTodoCategoryUseCase> = {
  provide: UpdateTodoCategoryUseCase,
  inject: [
    TODO_CATEGORY_REPOSITORY,
    TODO_CATEGORY_CACHE,
    MUTATION_LOCK,
    UNIT_OF_WORK,
    DOMAIN_EVENT_PUBLISHER,
  ],
  useFactory: (
    repository: ConstructorParameters<typeof UpdateTodoCategoryUseCase>[0]["repository"],
    cache: ConstructorParameters<typeof UpdateTodoCategoryUseCase>[0]["cache"],
    mutationLock: ConstructorParameters<typeof UpdateTodoCategoryUseCase>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof UpdateTodoCategoryUseCase>[0]["unitOfWork"],
    eventPublisher: ConstructorParameters<typeof UpdateTodoCategoryUseCase>[0]["eventPublisher"],
  ) =>
    new UpdateTodoCategoryUseCase({
      repository,
      cache,
      mutationLock,
      unitOfWork,
      eventPublisher,
      logger: new Logger(UpdateTodoCategoryUseCase.name),
    }),
};
