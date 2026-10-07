import { Logger, type FactoryProvider } from "@nestjs/common";

import { ENTITLEMENT_READER } from "#api/modules/access/access-entitlement.public";
import { MUTATION_LOCK, UNIT_OF_WORK } from "#api/shared/application/ports/index";

import { TODO_CATEGORY_CACHE } from "./application/ports/categories/todo-category-cache.port.js";
import { TODO_CATEGORY_LIMIT_READER } from "./application/ports/categories/todo-category-limit-reader.port.js";
import { TODO_CATEGORY_REPOSITORY } from "./application/ports/categories/todo-category.repository.port.js";
import { TodoCategoryReader } from "./application/services/categories/todo-category.reader.js";
import { CreateTodoCategory } from "./application/use-cases/categories/create-todo-category.use-case.js";
import { DeleteTodoCategory } from "./application/use-cases/categories/delete-todo-category.use-case.js";
import { ReorderTodoCategory } from "./application/use-cases/categories/reorder-todo-category.use-case.js";
import { UpdateTodoCategory } from "./application/use-cases/categories/update-todo-category.use-case.js";

export const todoCategoryReaderProvider: FactoryProvider<TodoCategoryReader> = {
  provide: TodoCategoryReader,
  inject: [TODO_CATEGORY_REPOSITORY, TODO_CATEGORY_CACHE, ENTITLEMENT_READER],
  useFactory: (
    repository: ConstructorParameters<typeof TodoCategoryReader>[0]["repository"],
    cache: ConstructorParameters<typeof TodoCategoryReader>[0]["cache"],
    entitlementReader: ConstructorParameters<typeof TodoCategoryReader>[0]["entitlementReader"],
  ) =>
    new TodoCategoryReader({
      repository,
      cache,
      entitlementReader,
    }),
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
  inject: [TODO_CATEGORY_REPOSITORY, TODO_CATEGORY_CACHE],
  useFactory: (
    repository: ConstructorParameters<typeof UpdateTodoCategory>[0]["repository"],
    cache: ConstructorParameters<typeof UpdateTodoCategory>[0]["cache"],
  ) =>
    new UpdateTodoCategory({
      repository,
      cache,
      logger: new Logger(UpdateTodoCategory.name),
    }),
};
