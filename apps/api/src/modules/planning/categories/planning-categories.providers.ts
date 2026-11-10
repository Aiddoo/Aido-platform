import type { Provider } from "@nestjs/common";

import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { DomainEventPublisherPort } from "#api/shared/application/ports/domain-event-publisher.port";
import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { RemoveCategoryTodosUseCase } from "../todos/application/use-cases/remove-category-todos.use-case.js";
import { TodoCategoryCachePort } from "./application/ports/todo-category-cache.port.js";
import { TodoCategoryCountReaderPort } from "./application/ports/todo-category-count.reader.port.js";
import { TodoCategoryLimitReaderPort } from "./application/ports/todo-category-limit.reader.port.js";
import { TodoCategoryProvisionerPort } from "./application/ports/todo-category-provisioner.port.js";
import { TodoCategoryReaderPort } from "./application/ports/todo-category.reader.port.js";
import { TodoCategoryRepositoryPort } from "./application/ports/todo-category.repository.port.js";
import { CreateTodoCategoryUseCase } from "./application/use-cases/create-todo-category.use-case.js";
import { DeleteTodoCategoryUseCase } from "./application/use-cases/delete-todo-category.use-case.js";
import { GetTodoCategoryDeletionPreviewUseCase } from "./application/use-cases/get-todo-category-deletion-preview.use-case.js";
import { GetTodoCategoryResourceLimitUseCase } from "./application/use-cases/get-todo-category-resource-limit.use-case.js";
import { GetTodoCategoryUseCase } from "./application/use-cases/get-todo-category.use-case.js";
import { ListTodoCategoriesUseCase } from "./application/use-cases/list-todo-categories.use-case.js";
import { ReorderTodoCategoryUseCase } from "./application/use-cases/reorder-todo-category.use-case.js";
import { UpdateTodoCategoryUseCase } from "./application/use-cases/update-todo-category.use-case.js";
import { DefaultTodoCategoryProvisionerAdapter } from "./infrastructure/adapters/default-todo-category-provisioner.adapter.js";
import { TodoCategoryCacheAdapter } from "./infrastructure/adapters/todo-category-cache.adapter.js";
import { TodoCategoryLimitReaderAdapter } from "./infrastructure/adapters/todo-category-limit-reader.adapter.js";
import { TodoCategoryReaderAdapter } from "./infrastructure/adapters/todo-category-reader.adapter.js";
import { DrizzleTodoCategoryRepository } from "./infrastructure/persistence/drizzle-todo-category.repository.js";

export const PLANNING_CATEGORIES_PROVIDERS = [
  { provide: TodoCategoryRepositoryPort, useClass: DrizzleTodoCategoryRepository },
  { provide: TodoCategoryCachePort, useClass: TodoCategoryCacheAdapter },
  { provide: TodoCategoryLimitReaderPort, useClass: TodoCategoryLimitReaderAdapter },
  provideUseCase(TodoCategoryReaderAdapter, { repository: TodoCategoryRepositoryPort }),
  { provide: TodoCategoryReaderPort, useExisting: TodoCategoryReaderAdapter },
  { provide: TodoCategoryCountReaderPort, useExisting: TodoCategoryReaderAdapter },
  { provide: TodoCategoryProvisionerPort, useClass: DefaultTodoCategoryProvisionerAdapter },
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
  provideUseCase(CreateTodoCategoryUseCase, {
    clock: ClockPort,
    repository: TodoCategoryRepositoryPort,
    cache: TodoCategoryCachePort,
    limitReader: TodoCategoryLimitReaderPort,
    mutationLock: MutationLockPort,
    unitOfWork: UnitOfWorkPort,
    logger: loggerFor(CreateTodoCategoryUseCase),
  }),
  provideUseCase(UpdateTodoCategoryUseCase, {
    clock: ClockPort,
    repository: TodoCategoryRepositoryPort,
    cache: TodoCategoryCachePort,
    mutationLock: MutationLockPort,
    unitOfWork: UnitOfWorkPort,
    eventPublisher: DomainEventPublisherPort,
    logger: loggerFor(UpdateTodoCategoryUseCase),
  }),
  provideUseCase(DeleteTodoCategoryUseCase, {
    repository: TodoCategoryRepositoryPort,
    categoryTodos: RemoveCategoryTodosUseCase,
    cache: TodoCategoryCachePort,
    mutationLock: MutationLockPort,
    unitOfWork: UnitOfWorkPort,
    clock: ClockPort,
    eventPublisher: DomainEventPublisherPort,
    logger: loggerFor(DeleteTodoCategoryUseCase),
  }),
  provideUseCase(ReorderTodoCategoryUseCase, {
    repository: TodoCategoryRepositoryPort,
    cache: TodoCategoryCachePort,
    mutationLock: MutationLockPort,
    unitOfWork: UnitOfWorkPort,
    logger: loggerFor(ReorderTodoCategoryUseCase),
  }),
] satisfies Provider[];
