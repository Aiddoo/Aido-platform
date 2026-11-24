import { createHash } from "node:crypto";

import { TodoImportItem } from "#api/modules/planning/todo-imports/domain/todo-import-item.vo";
import {
  TodoImport,
  type TodoImportPrimitives,
} from "#api/modules/planning/todo-imports/domain/todo-import.aggregate";
import { ACCESS_FIXTURE_USER_ID } from "#test/fixtures/access/access-user.fixture";

// 권한 fixture(createEntitlementFixture)와 같은 사용자라 기간·카테고리 한도를 실제 판단으로 본다
export const TODO_IMPORT_FIXTURE_USER_ID = ACCESS_FIXTURE_USER_ID;
export const TODO_IMPORT_FIXTURE_OTHER_USER_ID = "clz7x5p8k0009qz0z8z8z8z8z";
export const TODO_IMPORT_FIXTURE_NOW = Temporal.Instant.from("2026-11-24T03:00:00Z");
export const TODO_IMPORT_FIXTURE_TODAY = Temporal.PlainDate.from("2026-11-24");
export const TODO_IMPORT_FIXTURE_CATEGORY_ID = 41;

/** 기기가 만드는 키처럼 64자 sha256 hex */
export function hashedKey(seed: string): string {
  return createHash("sha256").update(seed).digest("hex");
}

export const TODO_IMPORT_FIXTURE_COLLECTION_KEY = hashedKey("calendar-work");

export function createTodoImportFixture(overrides: Partial<TodoImportPrimitives> = {}): TodoImport {
  return TodoImport.reconstitute({
    id: "c00000000000000000000000a",
    userId: TODO_IMPORT_FIXTURE_USER_ID,
    source: "DEVICE_CALENDAR",
    status: "UPLOADING",
    idempotencyKey: "start-key-1",
    requestHash: hashedKey("request"),
    timezone: "Asia/Seoul",
    startDate: TODO_IMPORT_FIXTURE_TODAY,
    endDate: TODO_IMPORT_FIXTURE_TODAY.add({ days: 29 }),
    timeMode: "TIME",
    visibility: "PRIVATE",
    targets: [
      {
        kind: "EXISTING_CATEGORY",
        targetKey: "work",
        categoryId: TODO_IMPORT_FIXTURE_CATEGORY_ID,
      },
    ],
    collections: [
      {
        collectionKey: TODO_IMPORT_FIXTURE_COLLECTION_KEY,
        targetKey: "work",
        expectedItemCount: 10,
      },
    ],
    expectedItemCount: 10,
    receivedItemCount: 0,
    processedItemCount: 0,
    createdCount: 0,
    skippedDuplicateCount: 0,
    skippedCapacityCount: 0,
    skippedCategoryMissingCount: 0,
    skippedInvalidCount: 0,
    undoneCount: 0,
    keptCompletedCount: 0,
    firstDate: null,
    round: 0,
    recoveryCount: 0,
    failureReason: null,
    createdAt: TODO_IMPORT_FIXTURE_NOW,
    updatedAt: TODO_IMPORT_FIXTURE_NOW,
    committedAt: null,
    completedAt: null,
    undoRequestedAt: null,
    ...overrides,
  });
}

export function createTodoImportItemFixture(
  seed: string,
  overrides: Partial<TodoImportItem["value"]> = {},
): TodoImportItem {
  return TodoImportItem.create({
    sourceKey: hashedKey(seed),
    collectionKey: TODO_IMPORT_FIXTURE_COLLECTION_KEY,
    title: `일정 ${seed}`,
    startDate: TODO_IMPORT_FIXTURE_TODAY,
    endDate: null,
    localTime: "09:00",
    ...overrides,
  });
}
