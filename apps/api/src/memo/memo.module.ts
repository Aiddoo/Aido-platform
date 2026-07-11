/**
 * 메모 모듈 (클린아키텍처)
 *
 * 빠른 메모 CRUD, 고정, 순서 변경, 할 일 변환 기능을 제공한다.
 *
 * ## 의존성
 * - CqrsModule: TodoCreatorAdapter가 todo 커맨드 디스패치에 CommandBus를 사용
 *   (todo 전환 커밋에서 TodoFacade 주입으로 교체 시 제거 예정)
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
import { TODO_CREATOR } from "./application/ports/todo-creator.port";
import { MemoQueryUseCases } from "./application/queries";
import { MemoUseCases } from "./application/use-cases";
import { TodoCreatorAdapter } from "./infrastructure/adapters/todo-creator.adapter";
import { PrismaMemoRepository } from "./infrastructure/persistence/prisma-memo.repository";
import { MemoController } from "./presentation/memo.controller";

@Module({
	imports: [CqrsModule, TodoModule],
	controllers: [MemoController],
	providers: [
		MemoFacade,
		{ provide: MEMO_REPOSITORY, useClass: PrismaMemoRepository },
		{ provide: TODO_CREATOR, useClass: TodoCreatorAdapter },
		...MemoUseCases,
		...MemoQueryUseCases,
	],
	exports: [MemoFacade],
})
export class MemoModule {}
