import { TODO_IMPORT_TIME_MODES, TODO_VISIBILITIES } from '@aido/api/vocabulary';
import { type DateKey, dateKeySchema } from '@src/shared/date/date-key';
import { z } from 'zod';

// 시작할 때 서버로 보내는 선택. 일정 제목은 담지 않는다(새 카테고리 이름은 캘린더 이름이다)
export const todoImportSelectionSchema = z.object({
  startDate: dateKeySchema,
  endDate: dateKeySchema,
  timeMode: z.enum(TODO_IMPORT_TIME_MODES),
  visibility: z.enum(TODO_VISIBILITIES),
  targets: z.array(
    z.discriminatedUnion('kind', [
      z.object({
        targetKey: z.string(),
        kind: z.literal('NEW_CATEGORY'),
        name: z.string(),
        color: z.string(),
      }),
      z.object({
        targetKey: z.string(),
        kind: z.literal('EXISTING_CATEGORY'),
        categoryId: z.int(),
      }),
    ]),
  ),
  collections: z.array(
    z.object({
      collectionKey: z.string(),
      targetKey: z.string(),
      expectedItemCount: z.int().nonnegative(),
    }),
  ),
});
export type TodoImportSelection = z.infer<typeof todoImportSelectionSchema>;

export const TodoImportSelectionPolicy = {
  // 기기 오늘이 서버 오늘보다 늦어 거절된 선택을 오늘부터로 맞춘다. 기기 오늘이 그대로면 맞출 수 없다(null)
  findAdjustedToToday(
    selection: TodoImportSelection,
    todayKey: DateKey,
  ): TodoImportSelection | null {
    if (todayKey <= selection.startDate) {
      return null;
    }
    return {
      ...selection,
      startDate: todayKey,
      endDate: selection.endDate < todayKey ? todayKey : selection.endDate,
    };
  },
};
