import { z } from "zod";

/**
 * 출시 앱(1.14.x까지)이 번들한 응답 모양을 손으로 고정한 사본. 현재 계약에서 파생하지 않는다.
 * 출시 앱의 Zod는 strip 모드라 새 키를 버리므로 여기서도 strict를 쓰지 않는다.
 */
const releasedTodoItemSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  completed: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const releasedTodoSchema = z.object({
  id: z.number().int(),
  userId: z.string(),
  title: z.string(),
  content: z.string().nullable().optional(),
  sortOrder: z.number().int(),
  completed: z.boolean(),
  completedAt: z.string().nullable(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  scheduledTime: z.string().nullable(),
  isAllDay: z.boolean(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
  recurrenceGroupId: z.string().nullable(),
  category: z.object({
    id: z.number().int(),
    name: z.string(),
    color: z.string(),
    sortOrder: z.number().int(),
  }),
  items: z.array(releasedTodoItemSchema),
  itemStats: z.object({ total: z.number().int(), completed: z.number().int() }),
  commentCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const releasedCreateTodoResponseSchema = z.object({
  message: z.string(),
  todo: releasedTodoSchema,
});

export const releasedCreateRecurringTodoResponseSchema = z.object({
  message: z.string(),
  todos: z.array(releasedTodoSchema),
  count: z.number().int(),
});

export const releasedDeleteTodoResponseSchema = z.object({ message: z.string() });

export const releasedConvertMemoToTodosResponseSchema = z.object({
  message: z.string(),
  todos: z.array(releasedTodoSchema),
});

export const releasedParsedTodoSchema = z.object({
  title: z.string(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  scheduledTime: z.string().nullable(),
  isAllDay: z.boolean(),
  isRecurring: z.boolean(),
  recurrence: z
    .object({
      daysOfWeek: z.array(z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"])),
      endDate: z.string(),
    })
    .nullable(),
});
