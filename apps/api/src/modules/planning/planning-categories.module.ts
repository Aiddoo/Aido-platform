import { Module } from "@nestjs/common";

import { TODO_CATEGORY_CACHE } from "./application/ports/categories/todo-category-cache.port.js";
import { TODO_CATEGORY_LIMIT_READER } from "./application/ports/categories/todo-category-limit-reader.port.js";
import { TODO_CATEGORY_REPOSITORY } from "./application/ports/categories/todo-category.repository.port.js";
import { TodoCategoryReader } from "./application/services/categories/todo-category.reader.js";
import { TodoCategoryCacheAdapter } from "./infrastructure/adapters/categories/todo-category-cache.adapter.js";
import { TodoCategoryLimitReaderAdapter } from "./infrastructure/adapters/categories/todo-category-limit-reader.adapter.js";
import { PrismaTodoCategoryRepository } from "./infrastructure/persistence/categories/prisma-todo-category.repository.js";
import { DefaultTodoCategorySeeder } from "./infrastructure/seeders/categories/default-todo-category.seeder.js";
import {
  createTodoCategoryProvider,
  deleteTodoCategoryProvider,
  reorderTodoCategoryProvider,
  todoCategoryReaderProvider,
  updateTodoCategoryProvider,
} from "./planning-categories-application.providers.js";
import { TodoCategoryController } from "./presentation/controllers/categories/todo-category.controller.js";

/**
 * TodoCategory 모듈 (DDD 클린아키텍처 · use-case 기반).
 *
 * 사용자 할 일 카테고리의 생성/조회/수정/삭제/재배치를 담당한다. 컨트롤러와 크로스모듈(todo·ai)은
 * Controller는 endpoint UseCase와 Reader를 직접 주입한다.
 *
 * 회원가입 기본 카테고리 시딩은 CLS 트랜잭션에 참여하는
 * DefaultTodoCategorySeeder를 사용한다.
 */
@Module({
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
    createTodoCategoryProvider,
    updateTodoCategoryProvider,
    deleteTodoCategoryProvider,
    reorderTodoCategoryProvider,
    DefaultTodoCategorySeeder,
  ],
  exports: [TodoCategoryReader, DefaultTodoCategorySeeder],
})
export class TodoCategoryModule {}
