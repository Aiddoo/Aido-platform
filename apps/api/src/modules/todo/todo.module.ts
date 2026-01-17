import { Module } from "@nestjs/common";

import { TodoController } from "./todo.controller";
import { TodoRepository } from "./todo.repository";
import { TodoService } from "./todo.service";

/**
 * Todo 모듈
 *
 * 할 일 관리 기능을 담당합니다.
 * - CRUD 작업 (생성, 조회, 수정, 삭제)
 * - 커서 기반 페이지네이션
 * - 날짜별 조회
 */
@Module({
	controllers: [TodoController],
	providers: [TodoRepository, TodoService],
	exports: [TodoService],
})
export class TodoModule {}
