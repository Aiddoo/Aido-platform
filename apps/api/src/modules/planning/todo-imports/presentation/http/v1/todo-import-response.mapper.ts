import type { TodoImport as TodoImportResponse } from "@aido/api/contracts/todo-import/v1";

import { toIsoString } from "#api/shared/domain/time/instant";

import type { TodoImportReadModel } from "../../../application/read-models/todo-import.read-model.js";
import type { ReceivedTodoImportItems } from "../../../application/use-cases/receive-todo-import-items.use-case.js";
import type {
  ActiveTodoImportResponseDto,
  ReceiveTodoImportItemsResponseDto,
  TodoImportResponseDto,
} from "./todo-import.dto.js";

function toTodoImportBody(readModel: TodoImportReadModel): TodoImportResponse {
  const { counts } = readModel;
  return {
    id: readModel.id,
    source: readModel.source,
    status: readModel.status,
    startDate: readModel.startDate.toString(),
    endDate: readModel.endDate.toString(),
    timezone: readModel.timezone,
    timeMode: readModel.timeMode,
    visibility: readModel.visibility,
    expectedItemCount: readModel.expectedItemCount,
    receivedItemCount: readModel.receivedItemCount,
    processedItemCount: readModel.processedItemCount,
    counts: {
      created: counts.createdCount,
      skippedDuplicate: counts.skippedDuplicateCount,
      skippedCapacity: counts.skippedCapacityCount,
      skippedCategoryMissing: counts.skippedCategoryMissingCount,
      skippedInvalid: counts.skippedInvalidCount,
      undone: counts.undoneCount,
      keptCompleted: counts.keptCompletedCount,
    },
    collections: readModel.collections.map((collection) => ({ ...collection })),
    firstDate: readModel.firstDate?.toString() ?? null,
    undoableUntil: readModel.undoableUntil == null ? null : toIsoString(readModel.undoableUntil),
    createdAt: toIsoString(readModel.createdAt),
    completedAt: readModel.completedAt == null ? null : toIsoString(readModel.completedAt),
  };
}

export function toTodoImportResponse(readModel: TodoImportReadModel): TodoImportResponseDto {
  return { todoImport: toTodoImportBody(readModel) };
}

export function toActiveTodoImportResponse(
  readModel: TodoImportReadModel | null,
): ActiveTodoImportResponseDto {
  return { todoImport: readModel == null ? null : toTodoImportBody(readModel) };
}

export function toReceiveTodoImportItemsResponse(
  received: ReceivedTodoImportItems,
): ReceiveTodoImportItemsResponseDto {
  return { ...received };
}
