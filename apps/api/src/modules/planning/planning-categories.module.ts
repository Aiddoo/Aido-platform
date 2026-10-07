import { Module } from "@nestjs/common";

import { AccessModule } from "#api/modules/access/access-entitlement.public";

import { TODO_CATEGORY_CACHE } from "./application/ports/categories/todo-category-cache.port.js";
import { TODO_CATEGORY_LIMIT_READER } from "./application/ports/categories/todo-category-limit-reader.port.js";
import { TODO_CATEGORY_PROVISIONER } from "./application/ports/categories/todo-category-provisioner.port.js";
import { TODO_CATEGORY_READER } from "./application/ports/categories/todo-category-reader.port.js";
import { TODO_CATEGORY_REPOSITORY } from "./application/ports/categories/todo-category.repository.port.js";
import { TodoCategoryReader } from "./application/services/categories/todo-category.reader.js";
import { TodoCategoryCacheAdapter } from "./infrastructure/adapters/categories/todo-category-cache.adapter.js";
import { TodoCategoryLimitReaderAdapter } from "./infrastructure/adapters/categories/todo-category-limit-reader.adapter.js";
import { PrismaTodoCategoryRepository } from "./infrastructure/persistence/categories/prisma-todo-category.repository.js";
import { DefaultTodoCategorySeeder } from "./infrastructure/seeders/categories/default-todo-category.seeder.js";
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
import { TodoCategoryController } from "./presentation/controllers/categories/todo-category.controller.js";

@Module({
  imports: [AccessModule],
  controllers: [TodoCategoryController],
  providers: [
    {
      provide: TODO_CATEGORY_REPOSITORY,
      useClass: PrismaTodoCategoryRepository,
    },
    { provide: TODO_CATEGORY_CACHE, useClass: TodoCategoryCacheAdapter },
    {
      provide: TODO_CATEGORY_LIMIT_READER,
      useClass: TodoCategoryLimitReaderAdapter,
    },
    todoCategoryReaderProvider,
    { provide: TODO_CATEGORY_READER, useExisting: TodoCategoryReader },
    getTodoCategoriesProvider,
    getTodoCategoryProvider,
    getTodoCategoryResourceLimitProvider,
    createTodoCategoryProvider,
    updateTodoCategoryProvider,
    deleteTodoCategoryProvider,
    reorderTodoCategoryProvider,
    DefaultTodoCategorySeeder,
    { provide: TODO_CATEGORY_PROVISIONER, useExisting: DefaultTodoCategorySeeder },
  ],
  exports: [TODO_CATEGORY_READER, TODO_CATEGORY_PROVISIONER],
})
export class PlanningCategoriesModule {}
