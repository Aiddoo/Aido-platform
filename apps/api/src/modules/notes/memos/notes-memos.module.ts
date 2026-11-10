import { Module } from "@nestjs/common";

import { PlanningTodosModule } from "#api/modules/planning/todos/planning-todos.public";

import { PlanMemoWriterPort } from "./application/ports/plan-memo-writer.port.js";
import { NOTES_MEMOS_PROVIDERS } from "./notes-memos.providers.js";
import { MemoController } from "./presentation/http/v1/memo.controller.js";

@Module({
  imports: [PlanningTodosModule],
  controllers: [MemoController],
  providers: [...NOTES_MEMOS_PROVIDERS],
  exports: [PlanMemoWriterPort],
})
export class NotesMemosModule {}
