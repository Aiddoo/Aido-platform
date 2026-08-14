import { Module } from "@nestjs/common";

import { TODO_CATEGORY_REPOSITORY } from "./application/ports/todo-category.repository.port";
import { TODO_CATEGORY_CACHE } from "./application/ports/todo-category-cache.port";
import { TODO_CATEGORY_LIMIT_READER } from "./application/ports/todo-category-limit-reader.port";
import { TodoCategoryReader } from "./application/services/todo-category.reader";
import { CreateTodoCategoryUseCase } from "./application/use-cases/create-todo-category/create-todo-category.use-case";
import { DeleteTodoCategoryUseCase } from "./application/use-cases/delete-todo-category/delete-todo-category.use-case";
import { ReorderTodoCategoryUseCase } from "./application/use-cases/reorder-todo-category/reorder-todo-category.use-case";
import { UpdateTodoCategoryUseCase } from "./application/use-cases/update-todo-category/update-todo-category.use-case";
import { TodoCategoryCacheAdapter } from "./infrastructure/adapters/todo-category-cache.adapter";
import { TodoCategoryLimitReaderAdapter } from "./infrastructure/adapters/todo-category-limit-reader.adapter";
import { PrismaTodoCategoryRepository } from "./infrastructure/persistence/prisma-todo-category.repository";
import { DefaultTodoCategorySeeder } from "./infrastructure/seeders/default-todo-category.seeder";
import { TodoCategoryController } from "./presentation/todo-category.controller";

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
		TodoCategoryReader,
		CreateTodoCategoryUseCase,
		UpdateTodoCategoryUseCase,
		DeleteTodoCategoryUseCase,
		ReorderTodoCategoryUseCase,
		DefaultTodoCategorySeeder,
	],
	exports: [TodoCategoryReader, DefaultTodoCategorySeeder],
})
export class TodoCategoryModule {}
