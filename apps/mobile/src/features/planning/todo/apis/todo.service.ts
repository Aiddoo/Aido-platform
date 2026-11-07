import {
  type ChangeTodoCategoryInput,
  type CreateTodoInput,
  dailyCompletionsRangeResponseSchema,
  deleteTodoResponseSchema,
  friendTodoListResponseSchema,
  type GetTodosQuery,
  type ReorderTodoInput,
  type ToggleTodoCompleteInput,
  todoSummaryResponseSchema,
  type UpdateTodoInput,
  updateTodoResponseSchema,
  type UpdateTodoScheduleInput,
} from '@aido/api';
import type { ApiError } from '@src/core/errors/api-error';
import { err, ok, type Result } from '@src/core/errors/result';
import type { HttpClient } from '@src/core/ports/http';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import { isTodoSeriesNotFoundError, TodoSeriesNotCreatedError } from '../domains/todo-series.error';
import {
  createTodoEnvelopeSchema,
  reorderTodoEnvelopeSchema,
  todoDetailsEnvelopeSchema,
  todoListEnvelopeSchema,
  todoSeriesEnvelopeSchema,
  updateTodoEnvelopeSchema,
} from '../schemas/todo-envelope.schema';
import type {
  RepeatingTodoDraft,
  TodoEditScope,
  TodoSeries,
  TodoSeriesEditOptions,
  TodoUpdateScope,
} from '../schemas/todo-repeat.schema';
import type {
  DailyCompletionsResult,
  Todo,
  TodoDetails,
  TodoExistence,
  TodoSummary,
  TodoListResult,
} from '../schemas/todo.schema';
import {
  toCreateRepeatingTodoRequest,
  toFollowingCategoryRequest,
  toFollowingScheduleRequest,
  toTodoSeries,
  toUpdateTodoRequest,
} from './todo-series.mapper';
import {
  toDailyCompletionsResult,
  toFriendTodoListResult,
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

    return parseApiResponse(
      result,
      todoListEnvelopeSchema,
      toTodoListResult,
      '[TodoService] Invalid getTodos response',
    );
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

    return parseApiResponse(
      result,
      friendTodoListResponseSchema,
      toFriendTodoListResult,
      '[TodoService] Invalid getFriendTodos response',
    );
  };

  toggleTodoComplete = async (
    todoId: number,
    body: ToggleTodoCompleteInput,
  ): Promise<Result<Todo, ApiError>> => {
    const result = await this.#httpClient.patch(`v1/todos/${todoId}/complete`, body);

    return parseApiResponse(
      result,
      createTodoEnvelopeSchema,
      (data) => toTodo(data.todo),
      '[TodoService] Invalid toggleTodoComplete response',
    );
  };

  createTodo = async (params: CreateTodoInput): Promise<Result<Todo, ApiError>> => {
    const result = await this.#httpClient.post('v1/todos', params);

    return parseApiResponse(
      result,
      createTodoEnvelopeSchema,
      (data) => toTodo(data.todo),
      '[TodoService] Invalid createTodo response',
    );
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

    return parseApiResponse(
      result,
      updateTodoEnvelopeSchema,
      (data) => toTodo(data.todo),
      '[TodoService] Invalid updateTodo response',
    );
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

    return parseApiResponse(
      result,
      updateTodoEnvelopeSchema,
      (data) => toTodo(data.todo),
      '[TodoService] Invalid updateTodoSchedule response',
    );
  };

  deleteTodo = async (todoId: number, scope?: TodoEditScope): Promise<Result<void, ApiError>> => {
    const result =
      scope == null
        ? await this.#httpClient.delete(`v1/todos/${todoId}`)
        : await this.#httpClient.delete(`v1/todos/${todoId}`, { params: { scope } });

    return parseApiResponse(
      result,
      deleteTodoResponseSchema,
      () => undefined,
      '[TodoService] Invalid deleteTodo response',
    );
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

    return parseApiResponse(
      result,
      dailyCompletionsRangeResponseSchema,
      toDailyCompletionsResult,
      '[TodoService] Invalid getDailyCompletions response',
    );
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

    return parseApiResponse(
      result,
      dailyCompletionsRangeResponseSchema,
      toDailyCompletionsResult,
      '[TodoService] Invalid getFriendDailyCompletions response',
    );
  };

  /** 하루의 할 일 요약 (홈 위젯 스냅샷) — 서버는 기기 시간대 기준 오늘·내일만 허용한다 */
  getTodoSummary = async (
    date: string,
    signal?: AbortSignal,
  ): Promise<Result<TodoSummary, ApiError>> => {
    const result = await this.#httpClient.get('v1/todos/summary', { signal, params: { date } });

    return parseApiResponse(
      result,
      todoSummaryResponseSchema,
      toTodoSummary,
      '[TodoService] Invalid getTodoSummary response',
    );
  };

  createRepeatingTodo = async (
    draft: RepeatingTodoDraft,
  ): Promise<Result<{ todo: Todo; series: TodoSeries }, ApiError | TodoSeriesNotCreatedError>> => {
    const result = await this.#httpClient.post('v1/todos', toCreateRepeatingTodoRequest(draft));

    const parsed = parseApiResponse(
      result,
      createTodoEnvelopeSchema,
      (data) => data,
      '[TodoService] Invalid createRepeatingTodo response',
    );
    if (!parsed.ok) {
      return parsed;
    }

    const { todo, series } = parsed.value;
    if (series == null) {
      return err(new TodoSeriesNotCreatedError());
    }

    return ok({ todo: toTodo(todo), series: toTodoSeries(series) });
  };

  /** 규칙이 없는 옛 묶음과 경로가 없는 옛 서버는 없는 규칙으로 본다. 그 회차는 이 할 일만 고칠 수 있다 */
  getTodoSeries = async (
    seriesId: string,
    signal?: AbortSignal,
  ): Promise<Result<TodoSeries | null, ApiError>> => {
    const result = await this.#httpClient.get(`v1/todo-series/${seriesId}`, { signal });

    if (!result.ok) {
      return isTodoSeriesNotFoundError(result.error) ? ok(null) : result;
    }

    // 모르는 빈도면 규칙이 없는 것처럼 다룬다
    return parseApiResponse(
      result,
      todoSeriesEnvelopeSchema,
      (data) => (data.repeat == null ? null : toTodoSeries({ ...data, repeat: data.repeat })),
      '[TodoService] Invalid getTodoSeries response',
    );
  };

  /** 이 회차 뒤로 반복을 끝낸다. 이미 끝났으면 서버가 TODO_0846으로 알린다 */
  stopTodoSeries = async (todoId: number): Promise<Result<Todo, ApiError>> => {
    const result = await this.#httpClient.patch(
      `v1/todos/${todoId}`,
      toUpdateTodoRequest({}, { repeat: null }),
    );

    return parseApiResponse(
      result,
      updateTodoEnvelopeSchema,
      (data) => toTodo(data.todo),
      '[TodoService] Invalid stopTodoSeries response',
    );
  };

  reorderTodo = async (
    todoId: number,
    input: ReorderTodoInput,
  ): Promise<Result<Todo, ApiError>> => {
    const result = await this.#httpClient.patch(`v1/todos/${todoId}/reorder`, input);

    return parseApiResponse(
      result,
      reorderTodoEnvelopeSchema,
      (data) => toTodo(data.todo),
      '[TodoService] Invalid reorderTodo response',
    );
  };

  getTodoDetails = async (
    todoId: number,
    signal?: AbortSignal,
  ): Promise<Result<TodoDetails, ApiError>> => {
    const response = await this.#httpClient.get(`v1/todos/${todoId}/details`, { signal });

    return parseApiResponse(
      response,
      todoDetailsEnvelopeSchema,
      toTodoDetails,
      '[TodoService] Invalid todo details',
    );
  };

  changeTodoCategory = async (
    todoId: number,
    input: ChangeTodoCategoryInput,
    scope?: TodoUpdateScope,
  ): Promise<Result<Todo, ApiError>> => {
    const result =
      scope === 'THIS_AND_FOLLOWING'
        ? await this.#httpClient.patch(`v1/todos/${todoId}`, toFollowingCategoryRequest(input))
        : await this.#httpClient.patch(`v1/todos/${todoId}/category`, input);

    return parseApiResponse(
      result,
      updateTodoResponseSchema,
      (data) => toTodo(data.todo),
      '[TodoService] Invalid changeTodoCategory response',
    );
  };
}
