import { z } from "zod";

import { dateSchema, datetimeSchema, nullableDateSchema } from "../../../common/datetime.js";
import { entityIdSchema } from "../../../common/entity-id.js";
import {
  TODO_IMPORT_FAILURE_REASONS,
  TODO_IMPORT_SOURCES,
  TODO_IMPORT_STATUSES,
  TODO_IMPORT_TIME_MODES,
} from "../../../vocabulary/todo-import.constants.js";
import { todoVisibilitySchema } from "../../todo/v1/todo.common.js";
import { todoImportHashedKeySchema } from "./todo-import.common.js";

const countSchema = z.int().nonnegative();

export const todoImportCountsSchema = z
  .object({
    created: countSchema.meta({ description: "만든 할 일 수" }),
    skippedDuplicate: countSchema.meta({ description: "이미 가져온 일정이라 건너뛴 수" }),
    skippedCapacity: countSchema.meta({ description: "카테고리 자리가 없어 건너뛴 수" }),
    skippedCategoryMissing: countSchema.meta({ description: "카테고리가 사라져 건너뛴 수" }),
    skippedInvalid: countSchema.meta({ description: "날짜·제목이 올바르지 않아 건너뛴 수" }),
    undone: countSchema.meta({ description: "되돌리기로 지운 수" }),
    keptCompleted: countSchema.meta({ description: "되돌릴 때 완료돼 있어 남긴 수" }),
  })
  .meta({ description: "결과 수" });

export type TodoImportCounts = z.infer<typeof todoImportCountsSchema>;

export const todoImportSchema = z
  .object({
    id: entityIdSchema.meta({ description: "가져오기 id" }),
    source: z.enum(TODO_IMPORT_SOURCES).meta({ description: "일정 출처" }),
    status: z.enum(TODO_IMPORT_STATUSES).meta({
      description:
        "UPLOADING 업로드 중 → QUEUED 순서 대기 → RUNNING 만드는 중 → COMPLETED/FAILED. CANCELED·ABANDONED는 확정 전에 멈춤, UNDOING → UNDONE은 되돌리기",
    }),
    startDate: dateSchema,
    endDate: dateSchema,
    failureReason: z
      .enum(TODO_IMPORT_FAILURE_REASONS)
      .nullable()
      .meta({ description: "FAILED가 된 이유. FAILED가 아니면 null" }),
    timezone: z.string().meta({
      description:
        "날짜·시각을 해석한 IANA 시간대. 시작할 때 정해지고 이어 보내기·할 일 만들기가 모두 이 값을 쓴다",
    }),
    timeMode: z.enum(TODO_IMPORT_TIME_MODES),
    visibility: todoVisibilitySchema,
    expectedItemCount: countSchema.meta({ description: "시작할 때 기기가 센 일정 수" }),
    receivedItemCount: countSchema.meta({ description: "서버가 받은 일정 수 (같은 key는 한 번)" }),
    processedItemCount: countSchema.meta({ description: "할 일 만들기를 마친 일정 수" }),
    counts: todoImportCountsSchema,
    collections: z
      .array(
        z.object({
          collectionKey: todoImportHashedKeySchema,
          categoryId: z
            .int()
            .positive()
            .nullable()
            .meta({ description: "넣은 카테고리 id. 새 카테고리는 확정 전까지 null" }),
        }),
      )
      .meta({ description: "캘린더마다 넣은 카테고리" }),
    firstDate: nullableDateSchema.meta({ description: "만든 할 일 중 가장 이른 날짜" }),
    undoableUntil: datetimeSchema
      .nullable()
      .meta({ description: "되돌릴 수 있는 마지막 시각. 되돌릴 수 없으면 null" }),
    createdAt: datetimeSchema,
    completedAt: datetimeSchema.nullable(),
  })
  .meta({ id: "TodoImportDto", description: "캘린더 가져오기 한 건" });

export type TodoImport = z.infer<typeof todoImportSchema>;

export const todoImportResponseSchema = z.object({ todoImport: todoImportSchema });

export const activeTodoImportResponseSchema = z.object({
  todoImport: todoImportSchema.nullable().meta({ description: "처리 중인 가져오기. 없으면 null" }),
});

export const receiveTodoImportItemsResponseSchema = z.object({
  acceptedCount: countSchema.meta({ description: "이번 요청에서 새로 받은 수" }),
  receivedItemCount: countSchema.meta({ description: "지금까지 받은 수" }),
});
