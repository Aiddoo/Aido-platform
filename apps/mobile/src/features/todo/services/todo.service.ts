import type {
  CreateRecurringTodoInput,
  CreateTodoInput,
  GetTodosQuery,
  ReorderTodoInput,
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
import type { TodoRepository } from '../repositories/todo.repository';

export class TodoService {
  readonly #todoRepository: TodoRepository;

  constructor(todoRepository: TodoRepository) {
    this.#todoRepository = todoRepository;
  }

  getTodos = async (params: GetTodosQuery): Promise<Result<TodosResult, ApiError>> => {
    return this.#todoRepository.getTodos(params);
  };

  getFriendTodos = async (
    friendUserId: string,
    params: GetTodosQuery,
  ): Promise<Result<TodosResult, ApiError>> => {
    return this.#todoRepository.getFriendTodos(friendUserId, params);
  };

  toggleTodoComplete = async (
    todoId: number,
    body: ToggleTodoCompleteInput,
  ): Promise<Result<TodoItem, ApiError>> => {
    return this.#todoRepository.toggleTodoComplete(todoId, body);
  };

  createTodo = async (params: CreateTodoInput): Promise<Result<TodoItem, ApiError>> => {
    return this.#todoRepository.createTodo(params);
  };

  updateTodo = async (
    todoId: number,
    input: UpdateTodoInput,
  ): Promise<Result<TodoItem, ApiError>> => {
    return this.#todoRepository.updateTodo(todoId, input);
  };

  updateTodoSchedule = async (
    todoId: number,
    input: UpdateTodoScheduleInput,
  ): Promise<Result<TodoItem, ApiError>> => {
    return this.#todoRepository.updateTodoSchedule(todoId, input);
  };

  deleteTodo = async (todoId: number): Promise<Result<void, ApiError>> => {
    return this.#todoRepository.deleteTodo(todoId);
  };

  parseTodo = async (
    text: string,
    categoryId?: number,
  ): Promise<Result<ParsedTodoResult, ApiError>> => {
    return this.#todoRepository.parseTodo(text, categoryId);
  };

  getAiUsage = async (): Promise<Result<AiUsage, ApiError>> => {
    return this.#todoRepository.getAiUsage();
  };

  getDailyCompletions = async (
    startDate: string,
    endDate: string,
  ): Promise<Result<DailyCompletionsResult, ApiError>> => {
    return this.#todoRepository.getDailyCompletions(startDate, endDate);
  };

  reorderTodo = async (
    todoId: number,
    input: ReorderTodoInput,
  ): Promise<Result<TodoItem, ApiError>> => {
    return this.#todoRepository.reorderTodo(todoId, input);
  };

  createRecurringTodo = async (
    params: CreateRecurringTodoInput,
  ): Promise<Result<TodoItem[], ApiError>> => {
    return this.#todoRepository.createRecurringTodo(params);
  };
}
