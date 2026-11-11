import { Module } from "@nestjs/common";

import { NotesMemosModule } from "./memos/notes-memos.module.js";

@Module({
  imports: [NotesMemosModule],
  exports: [NotesMemosModule],
})
export class NotesModule {}
