import { startTodoImportRequestSchema } from '@aido/api/contracts/todo-import/v1';
import { dateKeyFieldSchema } from '@src/shared/date/date-key';
import { z } from 'zod';

import { importCollectionSchema } from '../domains/todo-import-collection.model';
import { importTargetSchema } from '../domains/todo-import-target.model';

const { timeMode, visibility } = startTodoImportRequestSchema.shape;

/** 캘린더 단계를 넘길 때 고른 캘린더(개수 포함)를 `collections`에 고정한다 */
export const todoImportFormSchema = z.object({
  startDate: dateKeyFieldSchema,
  endDate: dateKeyFieldSchema,
  /** null은 아직 고르지 않아 기본 선택을 쓴다 */
  collectionKeys: z.array(z.string()).nullable(),
  collections: z.array(importCollectionSchema),
  /** 없는 캘린더는 기본 연결 규칙을 따른다 */
  targets: z.record(z.string(), importTargetSchema),
  timeMode,
  visibility: visibility.unwrap(),
});
export type TodoImportFormValues = z.infer<typeof todoImportFormSchema>;
