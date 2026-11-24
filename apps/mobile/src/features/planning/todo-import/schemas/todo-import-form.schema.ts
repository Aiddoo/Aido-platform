import { startTodoImportRequestSchema } from '@aido/api/contracts/todo-import/v1';
import { dateKeyFieldSchema } from '@src/shared/date/date-key';
import { z } from 'zod';

import { importCollectionSchema } from '../domains/todo-import-collection.model';
import { importTargetSchema } from '../domains/todo-import-target.model';

const { timeMode, visibility } = startTodoImportRequestSchema.shape;

/** single: 고른 캘린더를 모두 한 곳에 넣는다(기본), separate: 캘린더마다 넣을 곳을 고른다 */
const todoImportCategoryModeSchema = z.enum(['single', 'separate']);
export type TodoImportCategoryMode = z.infer<typeof todoImportCategoryModeSchema>;

/** 캘린더 단계를 넘길 때 고른 캘린더(개수 포함)를 `collections`에 고정한다 */
export const todoImportFormSchema = z.object({
  startDate: dateKeyFieldSchema,
  endDate: dateKeyFieldSchema,
  /** null은 아직 고르지 않아 기본 선택을 쓴다 */
  collectionKeys: z.array(z.string()).nullable(),
  collections: z.array(importCollectionSchema),
  /** 캘린더마다 고른 곳. 없는 캘린더는 모두 넣을 곳이다. 한 곳에 넣는 동안에도 남겨 둬 다시 나누면 돌아온다 */
  targets: z.record(z.string(), importTargetSchema),
  categoryMode: todoImportCategoryModeSchema,
  /** 모두 넣을 곳. null은 아직 고르지 않아 새 할 일의 기본 카테고리이고, 단계를 넘길 때 고정한다 */
  singleTarget: importTargetSchema.nullable(),
  timeMode,
  visibility: visibility.unwrap(),
});
export type TodoImportFormValues = z.infer<typeof todoImportFormSchema>;
