import { startTodoImportRequestSchema } from '@aido/api/contracts/todo-import/v1';
import { dateKeyFieldSchema } from '@src/shared/date/date-key';
import { z } from 'zod';

import { importCollectionSchema } from '../domains/todo-import-collection.model';
import { importTargetSchema } from '../domains/todo-import-target.model';

const { timeMode, visibility } = startTodoImportRequestSchema.shape;

/** separate: 캘린더마다 카테고리를 고른다, single: 고른 캘린더를 카테고리 하나에 모은다 */
export const todoImportCategoryModeSchema = z.enum(['separate', 'single']);
export type TodoImportCategoryMode = z.infer<typeof todoImportCategoryModeSchema>;

/** 캘린더 단계를 넘길 때 고른 캘린더(개수 포함)를 `collections`에 고정한다 */
export const todoImportFormSchema = z.object({
  startDate: dateKeyFieldSchema,
  endDate: dateKeyFieldSchema,
  /** null은 아직 고르지 않아 기본 선택을 쓴다 */
  collectionKeys: z.array(z.string()).nullable(),
  collections: z.array(importCollectionSchema),
  /** 없는 캘린더는 기본 연결 규칙을 따른다. 한 카테고리에 모아도 남겨 둬 다시 나누면 돌아온다 */
  targets: z.record(z.string(), importTargetSchema),
  categoryMode: todoImportCategoryModeSchema,
  /** 한 카테고리에 모을 곳. null은 아직 고르지 않아 첫 캘린더의 곳을 쓴다 */
  singleTarget: importTargetSchema.nullable(),
  timeMode,
  visibility: visibility.unwrap(),
});
export type TodoImportFormValues = z.infer<typeof todoImportFormSchema>;
