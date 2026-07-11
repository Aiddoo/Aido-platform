import { Module } from "@nestjs/common";

import { TodoCategoryFacade } from "./application/facades/todo-category.facade";
import { TODO_CATEGORY_REPOSITORY } from "./application/ports/todo-category.repository.port";
import { TODO_CATEGORY_CACHE } from "./application/ports/todo-category-cache.port";
import { TodoCategoryReader } from "./application/services/todo-category.reader";
import { CreateTodoCategoryUseCase } from "./application/use-cases/create-todo-category/create-todo-category.use-case";
import { DeleteTodoCategoryUseCase } from "./application/use-cases/delete-todo-category/delete-todo-category.use-case";
import { ReorderTodoCategoryUseCase } from "./application/use-cases/reorder-todo-category/reorder-todo-category.use-case";
import { UpdateTodoCategoryUseCase } from "./application/use-cases/update-todo-category/update-todo-category.use-case";
import { TodoCategoryCacheAdapter } from "./infrastructure/adapters/todo-category-cache.adapter";
import { PrismaTodoCategoryRepository } from "./infrastructure/persistence/prisma-todo-category.repository";
import { TodoCategoryController } from "./presentation/todo-category.controller";
import { TodoCategoryRepository } from "./todo-category.repository";

/**
 * TodoCategory 모듈 (DDD 클린아키텍처 · use-case 기반).
 *
 * 사용자 할 일 카테고리의 생성/조회/수정/삭제/재배치를 담당한다. 컨트롤러와 크로스모듈(todo·ai)은
 * TodoCategoryFacade만 주입한다. 목록은 read-hot 데이터라 CacheService로 캐시하고 변경 시 무효화한다.
 *
 * 회원가입 기본 카테고리 시딩은 TodoCategoryFacade.seedDefaultCategories가 담당하며,
 * 내부적으로 CLS 트랜잭션에 참여하는 TodoCategoryRepository(createMany)를 사용한다.
 * (auth 프로비저닝은 USER_PROVISIONING_SEEDER 포트를 통해 이 파사드에 위임한다.)
 */
@Module({
	controllers: [TodoCategoryController],
	providers: [
		{
			provide: TODO_CATEGORY_REPOSITORY,
			useClass: PrismaTodoCategoryRepository,
		},
		{ provide: TODO_CATEGORY_CACHE, useClass: TodoCategoryCacheAdapter },
		TodoCategoryReader,
		CreateTodoCategoryUseCase,
		UpdateTodoCategoryUseCase,
		DeleteTodoCategoryUseCase,
		ReorderTodoCategoryUseCase,
		TodoCategoryRepository,
		TodoCategoryFacade,
	],
	exports: [TodoCategoryFacade],
})
export class TodoCategoryModule {}
