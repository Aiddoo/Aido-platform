/**
 * 메모 모듈 (클린아키텍처)
 *
 * 빠른 메모 CRUD, 고정, 순서 변경, 할 일 변환 기능을 제공한다.
 *
 * ## 의존성
 * - PlanningTodosModule: 메모 → 할 일 변환 시 TodoCreatorAdapter가 생성 UseCase에 위임
 *
 * ## 제한사항
 * - 사용자당 최대 20개, 메모 내용 최대 5000자
 */
import { Module } from "@nestjs/common";

import { PlanningTodosModule } from "../planning/planning-todos.module.js";
import { MEMO_REPOSITORY } from "./application/ports/memos/memo.repository.port.js";
import { TODO_CREATOR } from "./application/ports/memos/todo-creator.port.js";
import { TodoCreatorAdapter } from "./infrastructure/adapters/memos/todo-creator.adapter.js";
import { PrismaMemoRepository } from "./infrastructure/persistence/memos/prisma-memo.repository.js";
import { MEMO_PROVIDERS } from "./notes-memos.providers.js";
import { MemoController } from "./presentation/controllers/memos/memo.controller.js";

@Module({
  imports: [PlanningTodosModule],
  controllers: [MemoController],
  providers: [
    { provide: MEMO_REPOSITORY, useClass: PrismaMemoRepository },
    { provide: TODO_CREATOR, useClass: TodoCreatorAdapter },
    ...MEMO_PROVIDERS,
  ],
})
export class MemoModule {}
