/**
 * 메모 모듈
 *
 * 빠른 메모 CRUD, 고정, 순서 변경, 할 일 변환 기능을 제공합니다.
 *
 * @module MemoModule
 *
 * ## 의존성
 * - TodoModule: 메모 → 할 일 변환 시 TodoService 사용
 *
 * ## 제한사항
 * - 사용자당 최대 20개
 * - 메모 내용 최대 5000자
 */
import { Module } from "@nestjs/common";
import { TodoModule } from "../todo/todo.module";
import { MemoController } from "./memo.controller";
import { MemoRepository } from "./memo.repository";
import { MemoService } from "./memo.service";

@Module({
	imports: [TodoModule],
	controllers: [MemoController],
	providers: [MemoRepository, MemoService],
	exports: [MemoService],
})
export class MemoModule {}
