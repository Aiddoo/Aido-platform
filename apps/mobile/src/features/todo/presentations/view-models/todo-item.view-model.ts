import { formatTime, formatTime24, toDate, toNullableDate } from '@src/shared/utils/date';
import type { TodoItem } from '../../models/todo.model';

export interface TodoItemViewModel extends TodoItem {
  formattedTime: string | null;
  color: string;
  startDateObj: Date;
  endDateObj: Date | null;
  scheduledTime24: string | undefined;
  isRecurring: boolean;
}

export const toTodoItemViewModel = (todo: TodoItem): TodoItemViewModel => ({
  ...todo,
  formattedTime: todo.scheduledTime ? formatTime(todo.scheduledTime) : null,
  color: todo.category.color,
  startDateObj: toDate(todo.startDate),
  endDateObj: toNullableDate(todo.endDate),
  scheduledTime24: todo.scheduledTime ? formatTime24(todo.scheduledTime) : undefined,
  isRecurring: todo.recurrenceGroupId !== null,
});
