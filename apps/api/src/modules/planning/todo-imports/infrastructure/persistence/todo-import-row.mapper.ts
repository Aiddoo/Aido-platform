import type {
  todoImport as todoImportTable,
  todoImportItem as todoImportItemTable,
} from "#api/platform/database/schema/planning.schema";

import type { TodoImportId } from "../../domain/todo-import-id.vo.js";
import { TodoImportItem } from "../../domain/todo-import-item.vo.js";
import { TodoImport } from "../../domain/todo-import.aggregate.js";

type TodoImportRow = typeof todoImportTable.$inferSelect;
type TodoImportInsertRow = typeof todoImportTable.$inferInsert;
type TodoImportItemRow = Pick<
  typeof todoImportItemTable.$inferSelect,
  "sourceKey" | "collectionKey" | "title" | "startDate" | "endDate" | "localTime"
>;
type TodoImportItemInsertRow = typeof todoImportItemTable.$inferInsert;

export function toTodoImport(row: TodoImportRow): TodoImport {
  return TodoImport.reconstitute(row);
}

export function toTodoImportRow(todoImport: TodoImport): TodoImportInsertRow {
  return todoImport.toPrimitives();
}

export function toTodoImportItem(row: TodoImportItemRow): TodoImportItem {
  return TodoImportItem.reconstitute(row);
}

export function toTodoImportItemRow(
  importId: TodoImportId,
  item: TodoImportItem,
): TodoImportItemInsertRow {
  return { ...item.value, importId: importId.value, status: "PENDING" };
}
