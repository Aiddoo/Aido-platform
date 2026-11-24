import type { Provider } from "@nestjs/common";

import {
  RemoveCategoryTodosUseCase,
  TodoCachePort,
} from "#api/modules/planning/todos/planning-todos.public";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { DomainEventPublisherPort } from "#api/shared/application/ports/domain-event-publisher.port";
import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { TodoCategoryCachePort } from "./application/ports/todo-category-cache.port.js";
import { TodoCategoryCreatorPort } from "./application/ports/todo-category-creator.port.js";
import { TodoCategoryLimitReaderPort } from "./application/ports/todo-category-limit.reader.port.js";
import { TodoCategoryRepositoryPort } from "./application/ports/todo-category.repository.port.js";
import { CreateTodoCategoryUseCase } from "./application/use-cases/create-todo-category.use-case.js";
import { DeleteTodoCategoryUseCase } from "./application/use-cases/delete-todo-category.use-case.js";
import { GetTodoCategoryDeletionPreviewUseCase } from "./application/use-cases/get-todo-category-deletion-preview.use-case.js";
import { GetTodoCategoryResourceLimitUseCase } from "./application/use-cases/get-todo-category-resource-limit.use-case.js";
import { GetTodoCategoryUseCase } from "./application/use-cases/get-todo-category.use-case.js";
import { ListTodoCategoriesUseCase } from "./application/use-cases/list-todo-categories.use-case.js";
import { ReorderTodoCategoryUseCase } from "./application/use-cases/reorder-todo-category.use-case.js";
import { UpdateTodoCategoryUseCase } from "./application/use-cases/update-todo-category.use-case.js";
import { WriteTodoCategoryUseCase } from "./application/use-cases/write-todo-category.use-case.js";
import { TodoCategoryCreatorAdapter } from "./infrastructure/adapters/todo-category-creator.adapter.js";
import { TodoCategoryLimitReaderAdapter } from "./infrastructure/adapters/todo-category-limit-reader.adapter.js";
import { DrizzleTodoCategoryRepository } from "./infrastructure/persistence/drizzle-todo-category.repository.js";

export const PLANNING_TODO_CATEGORIES_PROVIDERS = [
  { provide: TodoCategoryRepositoryPort, useClass: DrizzleTodoCategoryRepository },
  { provide: TodoCategoryLimitReaderPort, useClass: TodoCategoryLimitReaderAdapter },
  provideUseCase(ListTodoCategoriesUseCase, {
    repository: TodoCategoryRepositoryPort,
    cache: TodoCategoryCachePort,
  }),
  provideUseCase(GetTodoCategoryUseCase, { repository: TodoCategoryRepositoryPort }),
  provideUseCase(GetTodoCategoryDeletionPreviewUseCase, {
    repository: TodoCategoryRepositoryPort,
  }),
  provideUseCase(GetTodoCategoryResourceLimitUseCase, {
    repository: TodoCategoryRepositoryPort,
    limitReader: TodoCategoryLimitReaderPort,
  }),
  provideUseCase(WriteTodoCategoryUseCase, {
    clock: ClockPort,
    repository: TodoCategoryRepositoryPort,
    limitReader: TodoCategoryLimitReaderPort,
  }),
  provideUseCase(TodoCategoryCreatorAdapter, {
    writeCategory: WriteTodoCategoryUseCase,
    cache: TodoCategoryCachePort,
    afterCommit: AfterCommitTaskRegistryPort,
  }),
  { provide: TodoCategoryCreatorPort, useExisting: TodoCategoryCreatorAdapter },
  provideUseCase(CreateTodoCategoryUseCase, {
    writeCategory: WriteTodoCategoryUseCase,
    cache: TodoCategoryCachePort,
    mutationLock: MutationLockPort,
    unitOfWork: UnitOfWorkPort,
    logger: loggerFor(CreateTodoCategoryUseCase),
  }),
  provideUseCase(UpdateTodoCategoryUseCase, {
    clock: ClockPort,
    repository: TodoCategoryRepositoryPort,
    cache: TodoCategoryCachePort,
    todoCache: TodoCachePort,
    afterCommit: AfterCommitTaskRegistryPort,
    mutationLock: MutationLockPort,
    unitOfWork: UnitOfWorkPort,
    eventPublisher: DomainEventPublisherPort,
    logger: loggerFor(UpdateTodoCategoryUseCase),
  }),
  provideUseCase(DeleteTodoCategoryUseCase, {
    repository: TodoCategoryRepositoryPort,
    categoryTodos: RemoveCategoryTodosUseCase,
    cache: TodoCategoryCachePort,
    todoCache: TodoCachePort,
    afterCommit: AfterCommitTaskRegistryPort,
    mutationLock: MutationLockPort,
    unitOfWork: UnitOfWorkPort,
    clock: ClockPort,
    eventPublisher: DomainEventPublisherPort,
    logger: loggerFor(DeleteTodoCategoryUseCase),
  }),
  provideUseCase(ReorderTodoCategoryUseCase, {
    clock: ClockPort,
    repository: TodoCategoryRepositoryPort,
    cache: TodoCategoryCachePort,
    todoCache: TodoCachePort,
    afterCommit: AfterCommitTaskRegistryPort,
    mutationLock: MutationLockPort,
    unitOfWork: UnitOfWorkPort,
    logger: loggerFor(ReorderTodoCategoryUseCase),
  }),
] satisfies Provider[];
