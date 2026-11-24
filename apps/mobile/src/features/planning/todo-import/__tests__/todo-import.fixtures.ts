import { todoImportSchema as todoImportDtoSchema } from '@aido/api/contracts/todo-import/v1';
import { type ErrorCodeType, Errors } from '@aido/api/errors';
import { ApiError } from '@src/core/errors/api-error';
import { defineFixture } from '@src/testing/fixture';
import type { z } from 'zod';

import { importCollectionSchema } from '../domains/todo-import-collection.model';
import { importItemSchema } from '../domains/todo-import-item.model';
import { todoImportSelectionSchema } from '../domains/todo-import-session.model';
import { todoImportSchema } from '../domains/todo-import.model';

export const IMPORT_ID = 'clz7x5p8k0010qz0z8z8z8z8z';
export const PERSONAL_COLLECTION_KEY = 'a'.repeat(64);

const TODO_IMPORT: z.input<typeof todoImportDtoSchema> = {
  id: IMPORT_ID,
  source: 'DEVICE_CALENDAR',
  status: 'UPLOADING',
  startDate: '2026-11-24',
  endDate: '2026-12-23',
  timezone: 'Asia/Seoul',
  timeMode: 'TIME',
  visibility: 'PRIVATE',
  expectedItemCount: 2,
  receivedItemCount: 0,
  processedItemCount: 0,
  counts: {
    created: 0,
    skippedDuplicate: 0,
    skippedCapacity: 0,
    skippedCategoryMissing: 0,
    skippedInvalid: 0,
    undone: 0,
    keptCompleted: 0,
  },
  collections: [{ collectionKey: PERSONAL_COLLECTION_KEY, categoryId: null }],
  firstDate: null,
  undoableUntil: null,
  createdAt: '2026-11-24T01:00:00.000Z',
  completedAt: null,
};

export const createTodoImportDto = defineFixture(todoImportDtoSchema, TODO_IMPORT);

export const createTodoImport = defineFixture(todoImportSchema, TODO_IMPORT);

export const createImportCollection = defineFixture(importCollectionSchema, {
  collectionKey: PERSONAL_COLLECTION_KEY,
  title: '개인',
  color: '#FF6B43',
  accountName: 'iCloud',
  accountKind: 'cloud',
  itemCount: 2,
});

export const createImportItem = defineFixture(importItemSchema, {
  sourceKey: '1'.repeat(64),
  collectionKey: PERSONAL_COLLECTION_KEY,
  title: '팀 회의',
  startDate: '2026-11-25',
  endDate: null,
  localTime: '10:00',
});

export const createTodoImportSelection = defineFixture(todoImportSelectionSchema, {
  startDate: '2026-11-24',
  endDate: '2026-12-23',
  timeMode: 'TIME',
  visibility: 'PRIVATE',
  targets: [{ targetKey: 'new-0', kind: 'NEW_CATEGORY', name: '개인', color: '#FF6B43' }],
  collections: [
    { collectionKey: PERSONAL_COLLECTION_KEY, targetKey: 'new-0', expectedItemCount: 2 },
  ],
});

/** 상태를 주지 않으면 서버 카탈로그가 그 코드에 붙이는 상태다 */
export function createTodoImportApiError({
  code,
  details = null,
  status = Errors[code].httpStatus,
  retryAfterMs = null,
}: {
  code: ErrorCodeType;
  details?: Record<string, unknown> | null;
  status?: number;
  retryAfterMs?: number | null;
}) {
  return new ApiError(code, Errors[code].message, status, details, { retryAfterMs });
}
