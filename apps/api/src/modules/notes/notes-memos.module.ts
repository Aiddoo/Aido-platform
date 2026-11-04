import { Module } from "@nestjs/common";

import { PlanningTodosModule } from "../planning/planning-todos.public.js";
import { MEMO_REPOSITORY } from "./application/ports/memos/memo.repository.port.js";
import { PLAN_MEMO_WRITER } from "./application/ports/memos/plan-memo-writer.port.js";
import { DrizzleMemoRepository } from "./infrastructure/persistence/memos/drizzle-memo.repository.js";
import { planMemoWriterProvider } from "./notes-memos-application.providers.js";
import { MEMO_PROVIDERS } from "./notes-memos.providers.js";
import { MemoController } from "./presentation/controllers/memos/v1/memo.controller.js";

@Module({
  imports: [PlanningTodosModule],
  controllers: [MemoController],
  providers: [
    { provide: MEMO_REPOSITORY, useClass: DrizzleMemoRepository },
    ...MEMO_PROVIDERS,
    planMemoWriterProvider,
  ],
  exports: [PLAN_MEMO_WRITER],
})
export class NotesMemosModule {}
