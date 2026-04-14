import { dayOfWeekSchema } from '@aido/validators';
import { z } from 'zod';
import { subTodoSchema, subTodoStatsSchema } from './sub-todo.model';

export { type SubTodo, SubTodoPolicy, type SubTodoStats } from './sub-todo.model';

export const todoVisibilitySchema = z.enum(['PUBLIC', 'PRIVATE']);
export type TodoVisibility = z.infer<typeof todoVisibilitySchema>;

export const todoCategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  color: z.string(),
});
export type TodoCategory = z.infer<typeof todoCategorySchema>;

export const todoItemSchema = z.object({
  id: z.number(),
  title: z.string(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  category: todoCategorySchema,
  completed: z.boolean(),
  scheduledTime: z.date().nullable(),
  isAllDay: z.boolean(),
  visibility: todoVisibilitySchema,
  recurrenceGroupId: z.string().nullable(),
  subTodos: z.array(subTodoSchema),
  subTodoStats: subTodoStatsSchema,
});
export type TodoItem = z.infer<typeof todoItemSchema>;
export type OptimisticTodoItem = TodoItem & { readonly optimistic: true };

export const todosByDateSchema = z.object({
  date: z.string(),
  todos: z.array(todoItemSchema),
});
export type TodosByDate = z.infer<typeof todosByDateSchema>;

export const todosResultSchema = z.object({
  todos: z.array(todoItemSchema),
  hasNext: z.boolean(),
  nextCursor: z.number().nullable(),
});
export type TodosResult = z.infer<typeof todosResultSchema>;

export const todoRecurrenceSchema = z.object({
  daysOfWeek: z.array(dayOfWeekSchema).min(1).max(7),
  endDate: z.date(),
});
export type TodoRecurrence = z.infer<typeof todoRecurrenceSchema>;

export const parsedTodoDataSchema = z.object({
  title: z.string(),
  startDate: z.date(),
  endDate: z.date().nullable(),
  scheduledTime: z.string().nullable(),
  isAllDay: z.boolean(),
  isRecurring: z.boolean(),
  recurrence: todoRecurrenceSchema.nullable(),
  categoryId: z.number().optional(),
});
export type ParsedTodoData = z.infer<typeof parsedTodoDataSchema>;

export const tokenUsageSchema = z.object({
  input: z.number(),
  output: z.number(),
});
export type TokenUsage = z.infer<typeof tokenUsageSchema>;

export const parseTodoMetaSchema = z.object({
  model: z.string(),
  processingTimeMs: z.number(),
  tokenUsage: tokenUsageSchema,
});
export type ParseTodoMeta = z.infer<typeof parseTodoMetaSchema>;

export const parsedTodoResultSchema = z.object({
  data: parsedTodoDataSchema,
  meta: parseTodoMetaSchema,
});
export type ParsedTodoResult = z.infer<typeof parsedTodoResultSchema>;

export const aiUsageSchema = z.object({
  used: z.number(),
  limit: z.number().nullable(),
  resetsAt: z.string(),
});
export type AiUsage = z.infer<typeof aiUsageSchema>;

// Daily Completion
export const dailyCompletionSummaryClientSchema = z.object({
  date: z.string(),
  totalTodos: z.number(),
  completedTodos: z.number(),
  isComplete: z.boolean(),
  completionRate: z.number(),
  categoryColors: z.array(z.string()),
});
export type DailyCompletionSummary = z.infer<typeof dailyCompletionSummaryClientSchema>;

export const dailyCompletionsResultSchema = z.object({
  completions: z.array(dailyCompletionSummaryClientSchema),
  totalCompleteDays: z.number(),
  dateRange: z.object({
    startDate: z.string(),
    endDate: z.string(),
  }),
});
export type DailyCompletionsResult = z.infer<typeof dailyCompletionsResultSchema>;

/** AI 사용량 관련 도메인 규칙 */
export const AiUsagePolicy = {
  /** 무료 사용자의 AI 파싱 한도에 도달했는지 (limit이 null이면 프리미엄 = 무제한) */
  isLimitReached(usage: AiUsage): boolean {
    return usage.limit != null && usage.used >= usage.limit;
  },

  /** 남은 사용 횟수 (null이면 무제한/프리미엄) */
  getRemainingCount(usage: AiUsage): number | null {
    return usage.limit != null ? usage.limit - usage.used : null;
  },
} as const;
