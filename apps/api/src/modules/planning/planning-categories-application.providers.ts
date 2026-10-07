import { Logger, type FactoryProvider } from "@nestjs/common";

import { ENTITLEMENT_READER } from "#api/modules/access/access-entitlement.public";
import { MUTATION_LOCK, UNIT_OF_WORK } from "#api/shared/application/ports/index";

import { TODO_CATEGORY_CACHE } from "./application/ports/categories/todo-category-cache.port.js";
import { TODO_CATEGORY_LIMIT_READER } from "./application/ports/categories/todo-category-limit-reader.port.js";
import { TODO_CATEGORY_REPOSITORY } from "./application/ports/categories/todo-category.repository.port.js";
import { TodoCategoryReader } from "./application/services/categories/todo-category.reader.js";
import { CreateTodoCategory } from "./application/use-cases/categories/create-todo-category.use-case.js";
import { DeleteTodoCategory } from "./application/use-cases/categories/delete-todo-category.use-case.js";
import { GetTodoCategories } from "./application/use-cases/categories/get-todo-categories.use-case.js";
import { GetTodoCategoryResourceLimit } from "./application/use-cases/categories/get-todo-category-resource-limit.use-case.js";
import { GetTodoCategory } from "./application/use-cases/categories/get-todo-category.use-case.js";
import { ReorderTodoCategory } from "./application/use-cases/categories/reorder-todo-category.use-case.js";
import { UpdateTodoCategory } from "./application/use-cases/categories/update-todo-category.use-case.js";

export const todoCategoryReaderProvider: FactoryProvider<TodoCategoryReader> = {
  provide: TodoCategoryReader,
  inject: [TODO_CATEGORY_REPOSITORY],
  useFactory: (repository: ConstructorParameters<typeof TodoCategoryReader>[0]["repository"]) =>
    new TodoCategoryReader({ repository }),
};

export const getTodoCategoriesProvider: FactoryProvider<GetTodoCategories> = {
  provide: GetTodoCategories,
  inject: [TODO_CATEGORY_REPOSITORY, TODO_CATEGORY_CACHE],
  useFactory: (
    repository: ConstructorParameters<typeof GetTodoCategories>[0]["repository"],
    cache: ConstructorParameters<typeof GetTodoCategories>[0]["cache"],
  ) => new GetTodoCategories({ repository, cache }),
};

export const getTodoCategoryProvider: FactoryProvider<GetTodoCategory> = {
  provide: GetTodoCategory,
  inject: [TODO_CATEGORY_REPOSITORY],
  useFactory: (repository: ConstructorParameters<typeof GetTodoCategory>[0]["repository"]) =>
    new GetTodoCategory({ repository }),
};

export const getTodoCategoryResourceLimitProvider: FactoryProvider<GetTodoCategoryResourceLimit> = {
  provide: GetTodoCategoryResourceLimit,
  inject: [TODO_CATEGORY_REPOSITORY, ENTITLEMENT_READER],
  useFactory: (
    repository: ConstructorParameters<typeof GetTodoCategoryResourceLimit>[0]["repository"],
    entitlementReader: ConstructorParameters<
      typeof GetTodoCategoryResourceLimit
    >[0]["entitlementReader"],
  ) => new GetTodoCategoryResourceLimit({ repository, entitlementReader }),
};

export const createTodoCategoryProvider: FactoryProvider<CreateTodoCategory> = {
  provide: CreateTodoCategory,
  inject: [
    TODO_CATEGORY_REPOSITORY,
    TODO_CATEGORY_CACHE,
    TODO_CATEGORY_LIMIT_READER,
    MUTATION_LOCK,
    UNIT_OF_WORK,
  ],
  useFactory: (
    repository: ConstructorParameters<typeof CreateTodoCategory>[0]["repository"],
    cache: ConstructorParameters<typeof CreateTodoCategory>[0]["cache"],
    limitReader: ConstructorParameters<typeof CreateTodoCategory>[0]["limitReader"],
    mutationLock: ConstructorParameters<typeof CreateTodoCategory>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof CreateTodoCategory>[0]["unitOfWork"],
  ) =>
    new CreateTodoCategory({
      repository,
      cache,
      limitReader,
      mutationLock,
      unitOfWork,
      logger: new Logger(CreateTodoCategory.name),
    }),
};

export const deleteTodoCategoryProvider: FactoryProvider<DeleteTodoCategory> = {
  provide: DeleteTodoCategory,
  inject: [TODO_CATEGORY_REPOSITORY, TODO_CATEGORY_CACHE, MUTATION_LOCK, UNIT_OF_WORK],
  useFactory: (
    repository: ConstructorParameters<typeof DeleteTodoCategory>[0]["repository"],
    cache: ConstructorParameters<typeof DeleteTodoCategory>[0]["cache"],
    mutationLock: ConstructorParameters<typeof DeleteTodoCategory>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof DeleteTodoCategory>[0]["unitOfWork"],
  ) =>
    new DeleteTodoCategory({
      repository,
      cache,
      mutationLock,
      unitOfWork,
      logger: new Logger(DeleteTodoCategory.name),
    }),
};

export const reorderTodoCategoryProvider: FactoryProvider<ReorderTodoCategory> = {
  provide: ReorderTodoCategory,
  inject: [TODO_CATEGORY_REPOSITORY, TODO_CATEGORY_CACHE, MUTATION_LOCK, UNIT_OF_WORK],
  useFactory: (
    repository: ConstructorParameters<typeof ReorderTodoCategory>[0]["repository"],
    cache: ConstructorParameters<typeof ReorderTodoCategory>[0]["cache"],
    mutationLock: ConstructorParameters<typeof ReorderTodoCategory>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof ReorderTodoCategory>[0]["unitOfWork"],
  ) =>
    new ReorderTodoCategory({
      repository,
      cache,
      mutationLock,
      unitOfWork,
      logger: new Logger(ReorderTodoCategory.name),
    }),
};

export const updateTodoCategoryProvider: FactoryProvider<UpdateTodoCategory> = {
  provide: UpdateTodoCategory,
  inject: [TODO_CATEGORY_REPOSITORY, TODO_CATEGORY_CACHE, MUTATION_LOCK, UNIT_OF_WORK],
  useFactory: (
    repository: ConstructorParameters<typeof UpdateTodoCategory>[0]["repository"],
    cache: ConstructorParameters<typeof UpdateTodoCategory>[0]["cache"],
    mutationLock: ConstructorParameters<typeof UpdateTodoCategory>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof UpdateTodoCategory>[0]["unitOfWork"],
  ) =>
    new UpdateTodoCategory({
      repository,
      cache,
      mutationLock,
      unitOfWork,
      logger: new Logger(UpdateTodoCategory.name),
    }),
};
