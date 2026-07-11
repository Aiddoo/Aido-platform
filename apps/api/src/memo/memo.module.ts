/**
 * 메모 모듈 (클린아키텍처)
 *
 * 빠른 메모 CRUD, 고정, 순서 변경, 할 일 변환 기능을 제공한다.
 *
 * ## 의존성
 * - TodoModule: 메모 → 할 일 변환 시 TodoCreatorAdapter가 TodoFacade에 위임
 *
 * ## 제한사항
 * - 사용자당 최대 20개, 메모 내용 최대 5000자
 */
import { Module } from "@nestjs/common";
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
	imports: [TodoModule],
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
