import { formatTime } from '@src/shared/utils/date';
import type { TodoItem } from '../../models/todo.model';

export interface TodoItemViewModel extends TodoItem {
  formattedTime: string | null;
  color: string;
}

export const toTodoItemViewModel = (todo: TodoItem): TodoItemViewModel => ({
  ...todo,
  formattedTime: todo.scheduledTime ? formatTime(todo.scheduledTime) : null,
  color: todo.category.color,
});
