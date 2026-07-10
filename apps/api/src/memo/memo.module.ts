/**
 * 메모 모듈 (클린아키텍처 + CQRS)
 *
 * 빠른 메모 CRUD, 고정, 순서 변경, 할 일 변환 기능을 제공한다.
 *
 * ## 의존성
 * - CqrsModule: 명령/조회 버스
 * - TodoModule: 메모 → 할 일 변환 시 CreateTodo/CreateRecurringTodos 커맨드 디스패치
 *   (핸들러 등록 보장을 위한 명시적 의존)
 *
 * ## 제한사항
 * - 사용자당 최대 20개, 메모 내용 최대 5000자
 */
import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { TodoModule } from "../todo/todo.module";
import { MemoFacade } from "./application/facades/memo.facade";
import { MEMO_REPOSITORY } from "./application/ports/memo.repository.port";
import { QueryHandlers } from "./application/queries/handlers";
import { CommandHandlers } from "./application/use-cases";
import { PrismaMemoRepository } from "./infrastructure/persistence/prisma-memo.repository";
import { MemoController } from "./presentation/memo.controller";

@Module({
	imports: [CqrsModule, TodoModule],
	controllers: [MemoController],
	providers: [
		MemoFacade,
		{ provide: MEMO_REPOSITORY, useClass: PrismaMemoRepository },
		...CommandHandlers,
		...QueryHandlers,
	],
	exports: [MemoFacade],
})
export class MemoModule {}
