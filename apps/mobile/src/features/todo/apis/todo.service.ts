import {
  type CreateTodoInput,
  dailyCompletionsRangeResponseSchema,
  deleteTodoResponseSchema,
  type GetTodosQuery,
  type ReorderTodoInput,
  reorderTodoResponseSchema,
  type ToggleTodoCompleteInput,
  todoDetailsResponseSchema,
  todoListResponseSchema,
  todoSeriesResponseSchema,
  createTodoResponseSchema,
  todoSummaryResponseSchema,
  type UpdateTodoInput,
  type UpdateTodoScheduleInput,
  updateTodoResponseSchema,
} from '@aido/api';
import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';

import type { TodoEditScope, TodoSeries, TodoUpdateScope } from '../domains/todo-repeat.model';
import { isTodoSeriesNotFoundError } from '../domains/todo-series.error';
import type {
  DailyCompletionsResult,
  Todo,
  TodoDetails,
  TodoExistence,
  TodoSummary,
  TodoListResult,
} from '../domains/todo.model';
import {
  type RepeatingTodoDraft,
  type TodoSeriesEditOptions,
  toCreateRepeatingTodoRequest,
  toFollowingScheduleRequest,
  toTodoSeries,
  toUpdateTodoRequest,
} from './todo-series.mapper';
import {
  toDailyCompletionsResult,
  toTodo,
  toTodoDetails,
  toTodoListResult,
  toTodoSummary,
} from './todo.mapper';

export class TodoService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  getTodos = async (
    params: GetTodosQuery,
    signal?: AbortSignal,
  ): Promise<Result<TodoListResult, ApiError>> => {
    const result = await this.#httpClient.get('v1/todos', {
      signal,
      params: {
        cursor: params.cursor,
        size: params.size,
        completed: params.completed,
        categoryId: params.categoryId,
        startDate: params.startDate,
        endDate: params.endDate,
      },
    });

    if (!result.ok) {
      return result;
    }

    const parsed = todoListResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[TodoService] Invalid getTodos response: ${parsed.error.message}`);
    }

    return ok(toTodoListResult(parsed.data));
  };

  /** 날짜 조건 없이 한 건씩만 읽어, 기간과 무관하게 할 일·완료한 할 일이 있는지 본다 */
  getTodoExistence = async (signal?: AbortSignal): Promise<Result<TodoExistence, ApiError>> => {
    const [anyTodo, completedTodo] = await Promise.all([
      this.getTodos({ size: 1 }, signal),
      this.getTodos({ size: 1, completed: true }, signal),
    ]);
    if (!anyTodo.ok) {
      return anyTodo;
    }
    if (!completedTodo.ok) {
      return completedTodo;
    }
    return ok({
      hasTodo: anyTodo.value.todos.length > 0,
      hasCompletedTodo: completedTodo.value.todos.length > 0,
    });
  };

  getFriendTodos = async (
    friendUserId: string,
    params: GetTodosQuery,
    signal?: AbortSignal,
  ): Promise<Result<TodoListResult, ApiError>> => {
    const result = await this.#httpClient.get(`v1/todos/friends/${friendUserId}`, {
      signal,
      params: {
        cursor: params.cursor,
        size: params.size,
        startDate: params.startDate,
        endDate: params.endDate,
      },
    });

    if (!result.ok) {
      return result;
    }

    const parsed = todoListResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoService] Invalid getFriendTodos response: ${parsed.error.message}`,
      );
    }

    return ok(toTodoListResult(parsed.data));
  };

  toggleTodoComplete = async (
    todoId: number,
    body: ToggleTodoCompleteInput,
  ): Promise<Result<Todo, ApiError>> => {
    const result = await this.#httpClient.patch(`v1/todos/${todoId}/complete`, body);

    if (!result.ok) {
      return result;
    }

    const parsed = createTodoResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoService] Invalid toggleTodoComplete response: ${parsed.error.message}`,
      );
    }

    return ok(toTodo(parsed.data.todo));
  };

  createTodo = async (params: CreateTodoInput): Promise<Result<Todo, ApiError>> => {
    const result = await this.#httpClient.post('v1/todos', params);

    if (!result.ok) {
      return result;
    }

    const parsed = createTodoResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[TodoService] Invalid createTodo response: ${parsed.error.message}`);
    }

    return ok(toTodo(parsed.data.todo));
  };

  updateTodo = async (
    todoId: number,
    input: UpdateTodoInput,
    options: TodoSeriesEditOptions = {},
  ): Promise<Result<Todo, ApiError>> => {
    const result = await this.#httpClient.patch(
      `v1/todos/${todoId}`,
      toUpdateTodoRequest(input, options),
    );

    if (!result.ok) {
      return result;
    }

    const parsed = updateTodoResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[TodoService] Invalid updateTodo response: ${parsed.error.message}`);
    }

    return ok(toTodo(parsed.data.todo));
  };

  updateTodoSchedule = async (
    todoId: number,
    input: UpdateTodoScheduleInput,
    scope?: TodoUpdateScope,
  ): Promise<Result<Todo, ApiError>> => {
    const result =
      scope === 'THIS_AND_FOLLOWING'
        ? await this.#httpClient.patch(`v1/todos/${todoId}`, toFollowingScheduleRequest(input))
        : await this.#httpClient.patch(`v1/todos/${todoId}/schedule`, input);

    if (!result.ok) {
      return result;
    }

    const parsed = updateTodoResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoService] Invalid updateTodoSchedule response: ${parsed.error.message}`,
      );
    }

    return ok(toTodo(parsed.data.todo));
  };

  deleteTodo = async (todoId: number, scope?: TodoEditScope): Promise<Result<void, ApiError>> => {
    const result =
      scope == null
        ? await this.#httpClient.delete(`v1/todos/${todoId}`)
        : await this.#httpClient.delete(`v1/todos/${todoId}`, { params: { scope } });

    if (!result.ok) {
      return result;
    }

    const parsed = deleteTodoResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[TodoService] Invalid deleteTodo response: ${parsed.error.message}`);
    }

    return ok(undefined);
  };

  getDailyCompletions = async (
    startDate: string,
    endDate: string,
    signal?: AbortSignal,
  ): Promise<Result<DailyCompletionsResult, ApiError>> => {
    const result = await this.#httpClient.get('v1/daily-completions', {
      signal,
      params: { startDate, endDate },
    });

    if (!result.ok) {
      return result;
    }

    const parsed = dailyCompletionsRangeResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoService] Invalid getDailyCompletions response: ${parsed.error.message}`,
      );
    }

    return ok(toDailyCompletionsResult(parsed.data));
  };

  /** 친구의 일일 완료 현황 — 공개(PUBLIC) 할 일 기준 집계 (친구 캘린더 마커용) */
  getFriendDailyCompletions = async (
    friendUserId: string,
    startDate: string,
    endDate: string,
    signal?: AbortSignal,
  ): Promise<Result<DailyCompletionsResult, ApiError>> => {
    const result = await this.#httpClient.get(`v1/daily-completions/friends/${friendUserId}`, {
      signal,
      params: { startDate, endDate },
    });

    if (!result.ok) {
      return result;
    }

    const parsed = dailyCompletionsRangeResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoService] Invalid getFriendDailyCompletions response: ${parsed.error.message}`,
      );
    }

    return ok(toDailyCompletionsResult(parsed.data));
  };

  /** 하루의 할 일 요약 (홈 위젯 스냅샷) — 서버는 기기 시간대 기준 오늘·내일만 허용한다 */
  getTodoSummary = async (
    date: string,
    signal?: AbortSignal,
  ): Promise<Result<TodoSummary, ApiError>> => {
    const result = await this.#httpClient.get('v1/todos/summary', { signal, params: { date } });

    if (!result.ok) {
      return result;
    }

    const parsed = todoSummaryResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoService] Invalid getTodoSummary response: ${parsed.error.message}`,
      );
    }

    return ok(toTodoSummary(parsed.data));
  };

  /** 반복 할 일을 만들면 서버가 첫 회차와 규칙을 돌려준다. 나머지 회차는 목록을 다시 읽어 본다 */
  createRepeatingTodo = async (
    draft: RepeatingTodoDraft,
  ): Promise<Result<{ todo: Todo; series: TodoSeries | null }, ApiError>> => {
    const result = await this.#httpClient.post('v1/todos', toCreateRepeatingTodoRequest(draft));

    if (!result.ok) {
      return result;
    }

    const parsed = createTodoResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoService] Invalid createRepeatingTodo response: ${parsed.error.message}`,
      );
    }

    return ok({
      todo: toTodo(parsed.data.todo),
      series: parsed.data.series == null ? null : toTodoSeries(parsed.data.series),
    });
  };

  /** 규칙이 없는 옛 묶음(TODO_0841)은 없는 규칙으로 본다. 그 회차는 이 할 일만 고칠 수 있다 */
  getTodoSeries = async (
    seriesId: string,
    signal?: AbortSignal,
  ): Promise<Result<TodoSeries | null, ApiError>> => {
    const result = await this.#httpClient.get(`v1/todo-series/${seriesId}`, { signal });

    if (!result.ok) {
      return isTodoSeriesNotFoundError(result.error) ? ok(null) : result;
    }

    const parsed = todoSeriesResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[TodoService] Invalid getTodoSeries response: ${parsed.error.message}`);
    }

    return ok(toTodoSeries(parsed.data));
  };

  /** 이 회차 뒤로 반복을 끝낸다. 이미 끝났으면 서버가 TODO_0846으로 알린다 */
  stopTodoSeries = async (todoId: number): Promise<Result<Todo, ApiError>> => {
    const result = await this.#httpClient.patch(
      `v1/todos/${todoId}`,
      toUpdateTodoRequest({}, { repeat: null }),
    );

    if (!result.ok) {
      return result;
    }

    const parsed = updateTodoResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoService] Invalid stopTodoSeries response: ${parsed.error.message}`,
      );
    }

    return ok(toTodo(parsed.data.todo));
  };

  reorderTodo = async (
    todoId: number,
    input: ReorderTodoInput,
  ): Promise<Result<Todo, ApiError>> => {
    const result = await this.#httpClient.patch(`v1/todos/${todoId}/reorder`, input);

    if (!result.ok) {
      return result;
    }

    const parsed = reorderTodoResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[TodoService] Invalid reorderTodo response: ${parsed.error.message}`);
    }

    return ok(toTodo(parsed.data.todo));
  };

  getTodoDetails = async (
    todoId: number,
    signal?: AbortSignal,
  ): Promise<Result<TodoDetails, ApiError>> => {
    const response = await this.#httpClient.get(`v1/todos/${todoId}/details`, { signal });

    if (!response.ok) {
      return response;
    }

    const parsed = todoDetailsResponseSchema.safeParse(response.value);
    if (!parsed.success) {
      throw new ParseError(`[TodoService] Invalid todo details: ${parsed.error.message}`);
    }

    return ok(toTodoDetails(parsed.data));
  };
}
