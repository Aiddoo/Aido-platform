import { z } from "zod";

import { dateSchema, nullableDateSchema, timeOfDaySchema } from "../../../common/datetime.js";
import { entityIdSchema } from "../../../common/entity-id.js";
import {
  TODO_IMPORT_LIMITS,
  TODO_IMPORT_SOURCES,
  TODO_IMPORT_TIME_MODES,
} from "../../../vocabulary/todo-import.constants.js";
import { TODO_LIMITS } from "../../../vocabulary/todo.constants.js";
import { createTodoCategorySchema } from "../../todo-category/v1/todo-category.request.js";
import { todoVisibilitySchema } from "../../todo/v1/todo.common.js";
import { todoImportHashedKeySchema, todoImportTargetKeySchema } from "./todo-import.common.js";

const newCategoryTargetSchema = z.object({
  targetKey: todoImportTargetKeySchema,
  kind: z.literal("NEW_CATEGORY"),
  name: createTodoCategorySchema.shape.name,
  color: createTodoCategorySchema.shape.color,
});

const existingCategoryTargetSchema = z.object({
  targetKey: todoImportTargetKeySchema,
  kind: z.literal("EXISTING_CATEGORY"),
  categoryId: z.int().positive().meta({ description: "내 카테고리 id" }),
});

export const todoImportTargetSchema = z
  .discriminatedUnion("kind", [newCategoryTargetSchema, existingCategoryTargetSchema])
  .meta({ description: "가져온 할 일을 넣을 카테고리 (새로 만들기 또는 기존)" });

export type TodoImportTarget = z.infer<typeof todoImportTargetSchema>;

export const todoImportCollectionSchema = z.object({
  collectionKey: todoImportHashedKeySchema.meta({ description: "캘린더 키 (sha256 hex)" }),
  targetKey: todoImportTargetKeySchema,
  expectedItemCount: z.int().nonnegative().max(TODO_IMPORT_LIMITS.MAX_ITEMS_PER_IMPORT).meta({
    description: "기기가 센 이 캘린더의 일정 수. 가져오기 한 번의 일정 수 한도를 미리 본다",
  }),
});

export type TodoImportCollection = z.infer<typeof todoImportCollectionSchema>;

export const startTodoImportRequestSchema = z
  .object({
    source: z.enum(TODO_IMPORT_SOURCES).meta({ description: "일정 출처" }),
    startDate: dateSchema.meta({ description: "가져올 기간의 첫날 (사용자 시간대 YYYY-MM-DD)" }),
    endDate: dateSchema.meta({ description: "가져올 기간의 마지막 날 (포함)" }),
    timeMode: z
      .enum(TODO_IMPORT_TIME_MODES)
      .meta({ description: "TIME은 시각·알림까지, DATE_ONLY는 날짜만 가져온다" }),
    visibility: todoVisibilitySchema
      .default("PRIVATE")
      .meta({ description: "가져온 할 일의 공개 범위 (기본 PRIVATE)" }),
    targets: z
      .array(todoImportTargetSchema)
      .min(1)
      .max(TODO_IMPORT_LIMITS.MAX_COLLECTIONS)
      .refine(
        (targets) => new Set(targets.map((target) => target.targetKey)).size === targets.length,
        { error: "대상 key가 겹칩니다" },
      ),
    collections: z
      .array(todoImportCollectionSchema)
      .min(1)
      .max(TODO_IMPORT_LIMITS.MAX_COLLECTIONS)
      .refine(
        (collections) =>
          new Set(collections.map((collection) => collection.collectionKey)).size ===
          collections.length,
        { error: "캘린더 key가 겹칩니다" },
      ),
  })
  .refine((request) => request.endDate >= request.startDate, {
    error: "마지막 날은 첫날 이후여야 합니다",
    path: ["endDate"],
  })
  .refine(
    (request) => {
      const targetKeys = new Set(request.targets.map((target) => target.targetKey));
      return request.collections.every((collection) => targetKeys.has(collection.targetKey));
    },
    { error: "캘린더가 없는 대상을 가리킵니다", path: ["collections"] },
  )
  .refine(
    (request) => {
      const usedTargetKeys = new Set(request.collections.map((collection) => collection.targetKey));
      return request.targets.every((target) => usedTargetKeys.has(target.targetKey));
    },
    { error: "어느 캘린더도 쓰지 않는 대상이 있습니다", path: ["targets"] },
  )
  .refine(
    (request) =>
      request.collections.reduce((sum, collection) => sum + collection.expectedItemCount, 0) <=
      TODO_IMPORT_LIMITS.MAX_ITEMS_PER_IMPORT,
    {
      error: `가져오기 한 번에 일정은 최대 ${TODO_IMPORT_LIMITS.MAX_ITEMS_PER_IMPORT}개입니다`,
      path: ["collections"],
    },
  );

export type StartTodoImportRequest = z.infer<typeof startTodoImportRequestSchema>;

export const todoImportItemSchema = z
  .object({
    sourceKey: todoImportHashedKeySchema.meta({ description: "일정 회차 키 (sha256 hex)" }),
    collectionKey: todoImportHashedKeySchema.meta({ description: "속한 캘린더 키" }),
    title: z
      .string()
      .trim()
      .min(1)
      .max(TODO_LIMITS.TITLE_MAX_LENGTH)
      // 캘린더 제목에 섞인 NUL은 PostgreSQL text에 들어가지 못해 업로드가 500이 된다
      .refine((title) => !title.includes("\u0000"), { error: "제목에 NUL 문자를 쓸 수 없습니다" })
      .meta({ description: `할 일 제목 (최대 ${TODO_LIMITS.TITLE_MAX_LENGTH}자)` }),
    startDate: dateSchema.meta({ description: "시작 날짜 (사용자 시간대)" }),
    endDate: nullableDateSchema.meta({ description: "여러 날 종일 일정의 마지막 날. 아니면 null" }),
    localTime: timeOfDaySchema
      .nullable()
      .meta({ description: "시작 시각 (HH:mm). DATE_ONLY이거나 종일이면 null" }),
  })
  .refine((item) => item.endDate == null || item.endDate > item.startDate, {
    error: "마지막 날은 시작 날짜 다음이어야 합니다",
    path: ["endDate"],
  });

export type TodoImportItem = z.infer<typeof todoImportItemSchema>;

export const receiveTodoImportItemsRequestSchema = z.object({
  items: z
    .array(todoImportItemSchema)
    .min(1)
    .max(TODO_IMPORT_LIMITS.MAX_ITEMS_PER_CHUNK)
    .refine((items) => new Set(items.map((item) => item.sourceKey)).size === items.length, {
      error: "일정 key가 겹칩니다",
    })
    .meta({
      description: `한 번에 보낼 일정 (최대 ${TODO_IMPORT_LIMITS.MAX_ITEMS_PER_CHUNK}개). 이미 받은 key는 무시한다`,
    }),
});

export type ReceiveTodoImportItemsRequest = z.infer<typeof receiveTodoImportItemsRequestSchema>;

export const todoImportIdParamSchema = z.object({
  importId: entityIdSchema.meta({ description: "가져오기 id" }),
});
