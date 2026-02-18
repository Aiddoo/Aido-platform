import type {
  CreateTodoInput,
  GetTodosQuery,
  ToggleTodoCompleteInput,
  UpdateTodoInput,
  UpdateTodoScheduleInput,
} from '@aido/validators';
import type { ApiError } from '@src/shared/errors/api-error';
import type { Result } from '@src/shared/errors/result';

import type {
  AiUsage,
  DailyCompletionsResult,
  ParsedTodoResult,
  TodoItem,
  TodosResult,
} from '../models/todo.model';

export interface TodoRepository {
  getTodos(params: GetTodosQuery): Promise<Result<TodosResult, ApiError>>;
  getFriendTodos(
    friendUserId: string,
    params: GetTodosQuery,
  ): Promise<Result<TodosResult, ApiError>>;
  toggleTodoComplete(
    todoId: number,
    body: ToggleTodoCompleteInput,
  ): Promise<Result<TodoItem, ApiError>>;
  createTodo(params: CreateTodoInput): Promise<Result<TodoItem, ApiError>>;
  updateTodo(todoId: number, input: UpdateTodoInput): Promise<Result<TodoItem, ApiError>>;
  updateTodoSchedule(
    todoId: number,
    input: UpdateTodoScheduleInput,
  ): Promise<Result<TodoItem, ApiError>>;
  deleteTodo(todoId: number): Promise<Result<void, ApiError>>;
  parseTodo(text: string): Promise<Result<ParsedTodoResult, ApiError>>;
  getAiUsage(): Promise<Result<AiUsage, ApiError>>;
  getDailyCompletions(
    startDate: string,
    endDate: string,
  ): Promise<Result<DailyCompletionsResult, ApiError>>;
}
