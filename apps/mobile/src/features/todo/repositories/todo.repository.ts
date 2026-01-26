import type { Todo, TodoListResponse } from '@aido/validators';

export interface GetTodosParams {
  cursor?: number;
  size?: number;
  completed?: boolean;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
}

export interface GetTodoCountsParams {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface TodoCountsResponse {
  counts: Record<string, number>; // date -> count
}

export interface ToggleTodoCompleteParams {
  todoId: number;
  completed: boolean;
}

export interface TodoRepository {
  getTodos(params: GetTodosParams): Promise<TodoListResponse>;
  getTodoCounts(params: GetTodoCountsParams): Promise<TodoCountsResponse>;
  toggleTodoComplete(params: ToggleTodoCompleteParams): Promise<Todo>;
}
