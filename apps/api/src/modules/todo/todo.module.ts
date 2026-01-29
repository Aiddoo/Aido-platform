import { Module } from "@nestjs/common";

import { FollowModule } from "../follow/follow.module";
import { TodoCategoryModule } from "../todo-category/todo-category.module";

import { TodoController } from "./todo.controller";
import { TodoRepository } from "./todo.repository";
import { TodoService } from "./todo.service";

/**
 * Todo 모듈
 *
 * 할 일 관리 기능을 담당합니다.
 * - CRUD 작업 (생성, 조회, 수정, 삭제)
 * - 카테고리별 분류 및 필터링
 * - 순서 변경 (드래그 앤 드롭)
 * - 커서 기반 페이지네이션
 * - 날짜별 조회
 * - 친구의 PUBLIC 투두 조회
 */
@Module({
	imports: [FollowModule, TodoCategoryModule],
	controllers: [TodoController],
	providers: [TodoRepository, TodoService],
	exports: [TodoService],
})
export class TodoModule {}
