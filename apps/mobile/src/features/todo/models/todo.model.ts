import { z } from 'zod';

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
});
export type TodoItem = z.infer<typeof todoItemSchema>;

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

export const parsedTodoDataSchema = z.object({
  title: z.string(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  scheduledTime: z.string().nullable(),
  isAllDay: z.boolean(),
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
