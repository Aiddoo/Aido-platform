import type { ConvertMemoToTodosInput } from '@aido/api';
import type { ParsedMemoTodo } from '@src/features/ai/domains/ai.model';

export function toReviewedMemoConversionInput(todos: ParsedMemoTodo[]): ConvertMemoToTodosInput {
  return {
    todos: todos.map((todo) => ({
      title: todo.title,
      categoryId: todo.categoryId,
      startDate: todo.startDate,
      endDate: todo.endDate ?? undefined,
      scheduledTime: todo.scheduledTime ?? undefined,
      isAllDay: todo.isAllDay,
      visibility: 'PUBLIC',
      isRecurring: todo.isRecurring,
      recurrence: todo.recurrence ?? undefined,
      items: todo.items,
    })),
  };
}
