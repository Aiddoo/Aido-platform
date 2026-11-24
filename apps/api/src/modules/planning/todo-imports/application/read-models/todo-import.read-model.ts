import type {
  TodoImportFailureReason,
  TodoImportSourceKind,
  TodoImportStatus,
  TodoImportTimeMode,
  TodoVisibility,
} from "@aido/api/vocabulary";

import type { TodoImport, TodoImportCounts } from "../../domain/todo-import.aggregate.js";

export interface TodoImportReadModel {
  readonly id: string;
  readonly source: TodoImportSourceKind;
  readonly status: TodoImportStatus;
  readonly startDate: Temporal.PlainDate;
  readonly endDate: Temporal.PlainDate;
  readonly timezone: string;
  readonly timeMode: TodoImportTimeMode;
  readonly visibility: TodoVisibility;
  readonly expectedItemCount: number;
  readonly receivedItemCount: number;
  readonly processedItemCount: number;
  readonly counts: TodoImportCounts;
  readonly collections: readonly {
    readonly collectionKey: string;
    readonly categoryId: number | null;
  }[];
  readonly firstDate: Temporal.PlainDate | null;
  readonly failureReason: TodoImportFailureReason | null;
  // 서버가 정한 되돌리기 마감. 되돌릴 수 없으면 null이라 앱이 다시 계산하지 않는다
  readonly undoableUntil: Temporal.Instant | null;
  readonly createdAt: Temporal.Instant;
  readonly completedAt: Temporal.Instant | null;
}

export function toTodoImportReadModel(
  todoImport: TodoImport,
  now: Temporal.Instant,
): TodoImportReadModel {
  const primitives = todoImport.toPrimitives();
  return {
    id: primitives.id,
    source: primitives.source,
    status: primitives.status,
    startDate: primitives.startDate,
    endDate: primitives.endDate,
    timezone: primitives.timezone,
    timeMode: primitives.timeMode,
    visibility: primitives.visibility,
    expectedItemCount: primitives.expectedItemCount,
    receivedItemCount: primitives.receivedItemCount,
    processedItemCount: primitives.processedItemCount,
    counts: {
      createdCount: primitives.createdCount,
      skippedDuplicateCount: primitives.skippedDuplicateCount,
      skippedCapacityCount: primitives.skippedCapacityCount,
      skippedCategoryMissingCount: primitives.skippedCategoryMissingCount,
      skippedInvalidCount: primitives.skippedInvalidCount,
      undoneCount: primitives.undoneCount,
      keptCompletedCount: primitives.keptCompletedCount,
    },
    collections: todoImport.collections.map((collection) => ({
      collectionKey: collection.collectionKey,
      categoryId: todoImport.findCategoryIdOf(collection.collectionKey),
    })),
    firstDate: primitives.firstDate,
    failureReason: primitives.failureReason,
    undoableUntil: findUndoableUntil(todoImport, now),
    createdAt: primitives.createdAt,
    completedAt: primitives.completedAt,
  };
}

function findUndoableUntil(todoImport: TodoImport, now: Temporal.Instant): Temporal.Instant | null {
  const window = todoImport.judgeUndo(now);
  return window.kind === "open" ? window.undoableUntil : null;
}
