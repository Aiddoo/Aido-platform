import { Module } from "@nestjs/common";

import { AccessModule } from "#api/modules/access/access-entitlement.public";

import { TODO_CATEGORY_CACHE } from "./application/ports/todo-category-cache.port.js";
import { TODO_CATEGORY_COUNT_READER } from "./application/ports/todo-category-count.reader.port.js";
import { TODO_CATEGORY_LIMIT_READER } from "./application/ports/todo-category-limit.reader.port.js";
import { TODO_CATEGORY_PROVISIONER } from "./application/ports/todo-category-provisioner.port.js";
import { TODO_CATEGORY_READER } from "./application/ports/todo-category.reader.port.js";
import { TODO_CATEGORY_REPOSITORY } from "./application/ports/todo-category.repository.port.js";
import { DefaultTodoCategoryProvisionerAdapter } from "./infrastructure/adapters/default-todo-category-provisioner.adapter.js";
import { TodoCategoryCacheAdapter } from "./infrastructure/adapters/todo-category-cache.adapter.js";
import { TodoCategoryLimitReaderAdapter } from "./infrastructure/adapters/todo-category-limit-reader.adapter.js";
import { TodoCategoryReaderAdapter } from "./infrastructure/adapters/todo-category-reader.adapter.js";
import { DrizzleTodoCategoryRepository } from "./infrastructure/persistence/drizzle-todo-category.repository.js";
import {
  createTodoCategoryProvider,
  deleteTodoCategoryProvider,
  getTodoCategoriesProvider,
  getTodoCategoryProvider,
  getTodoCategoryResourceLimitProvider,
  reorderTodoCategoryProvider,
  todoCategoryReaderProvider,
  updateTodoCategoryProvider,
} from "./planning-categories-application.providers.js";
import { TodoCategoryController } from "./presentation/http/v1/todo-category.controller.js";

@Module({
  imports: [AccessModule],
  controllers: [TodoCategoryController],
  providers: [
    {
      provide: TODO_CATEGORY_REPOSITORY,
      useClass: DrizzleTodoCategoryRepository,
    },
    { provide: TODO_CATEGORY_CACHE, useClass: TodoCategoryCacheAdapter },
    {
      provide: TODO_CATEGORY_LIMIT_READER,
      useClass: TodoCategoryLimitReaderAdapter,
    },
    todoCategoryReaderProvider,
    { provide: TODO_CATEGORY_READER, useExisting: TodoCategoryReaderAdapter },
    { provide: TODO_CATEGORY_COUNT_READER, useExisting: TodoCategoryReaderAdapter },
    getTodoCategoriesProvider,
    getTodoCategoryProvider,
    getTodoCategoryResourceLimitProvider,
    createTodoCategoryProvider,
    updateTodoCategoryProvider,
    deleteTodoCategoryProvider,
    reorderTodoCategoryProvider,
    DefaultTodoCategoryProvisionerAdapter,
    { provide: TODO_CATEGORY_PROVISIONER, useExisting: DefaultTodoCategoryProvisionerAdapter },
  ],
  exports: [TODO_CATEGORY_READER, TODO_CATEGORY_COUNT_READER, TODO_CATEGORY_PROVISIONER],
})
export class PlanningCategoriesModule {}
