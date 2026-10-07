import { Module } from "@nestjs/common";

import {
  PlanningTodosModule,
  STAGED_TODO_CREATOR as PLANNING_STAGED_TODO_CREATOR,
} from "../planning/planning-todos.public.js";
import { MEMO_REPOSITORY } from "./application/ports/memos/memo.repository.port.js";
import { STAGED_TODO_CREATOR } from "./application/ports/memos/staged-todo-creator.port.js";
import { PrismaMemoRepository } from "./infrastructure/persistence/memos/prisma-memo.repository.js";
import { MEMO_PROVIDERS } from "./notes-memos.providers.js";
import { MemoController } from "./presentation/controllers/memos/memo.controller.js";

@Module({
  imports: [PlanningTodosModule],
  controllers: [MemoController],
  providers: [
    { provide: MEMO_REPOSITORY, useClass: PrismaMemoRepository },
    { provide: STAGED_TODO_CREATOR, useExisting: PLANNING_STAGED_TODO_CREATOR },
    ...MEMO_PROVIDERS,
  ],
})
export class NotesMemosModule {}
