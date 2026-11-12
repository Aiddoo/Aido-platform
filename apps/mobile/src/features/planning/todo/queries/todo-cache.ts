import { invalidateTodoCategories } from '@src/features/planning/category/queries/todo-category-cache';
import type { DateKey } from '@src/shared/date/date-key';
import { isLastMutation } from '@src/shared/query/is-last-mutation';
import type {
  InvalidateQueryFilters,
  MutationFilters,
  Query,
  QueryClient,
  QueryKey,
} from '@tanstack/react-query';
import { last } from 'es-toolkit';

import { DailyCompletionPolicy } from '../domains/daily-completion.model';
import { type DailyCompletionsResult } from '../domains/daily-completion.model';
import {
  type Todo,
  type TodoListResult,
  type TodoOverview,
  TodoPolicy,
} from '../domains/todo.model';
import { todoDateQueryKeySchema, todoRangeQueryKeySchema } from '../schemas/todo-query-key.schema';
import { TODO_MUTATION_KEYS } from './todo-mutation-keys';
import { TODO_QUERY_KEYS } from './todo-query-keys';

export interface TodoSnapshot {
  date: DateKey;
  todo: Todo;
  index: number;
}

/** 할 일이 걸친 날짜. 여러 날 할 일만 시작일과 끝날이 다르다 */
export interface DateSpan {
  startDate: string;
  endDate: string;
}

export function getTodoDateSpan(todo: Pick<Todo, 'startDate' | 'endDate'>): DateSpan {
  return { startDate: todo.startDate, endDate: todo.endDate ?? todo.startDate };
}

/** 할 일의 기간. 그날 목록도 상세도 불러오지 않았으면 보고 있는 하루로 본다 */
export function getCachedTodoDateSpan(
  queryClient: QueryClient,
  { date, todoId }: { date: DateKey; todoId: number },
): DateSpan {
  const todo = findCachedTodo(queryClient, { date, todoId });
  return todo == null ? { startDate: date, endDate: date } : getTodoDateSpan(todo);
}

export function withTodoAdded(list: TodoListResult, todo: Todo): TodoListResult {
  return { ...list, todos: [...list.todos, todo] };
}

export function withTodoRemoved(list: TodoListResult, todoId: number): TodoListResult {
  return { ...list, todos: list.todos.filter((todo) => todo.id !== todoId) };
}

export function withTodoUpdated(
  list: TodoListResult,
  todoId: number,
  update: (todo: Todo) => Todo,
): TodoListResult {
  return { ...list, todos: list.todos.map((todo) => (todo.id === todoId ? update(todo) : todo)) };
}

/** 그 할 일 하나만 되돌린다. 아직 목록에 있으면 값만, 빠졌으면 원래 자리에 넣어 같은 날짜의 다른 변경은 지킨다 */
export function withTodoRestored(
  list: TodoListResult,
  snapshot: Pick<TodoSnapshot, 'todo' | 'index'>,
): TodoListResult {
  if (list.todos.some((todo) => todo.id === snapshot.todo.id)) {
    return withTodoUpdated(list, snapshot.todo.id, () => snapshot.todo);
  }
  return {
    ...list,
    todos: [
      ...list.todos.slice(0, snapshot.index),
      snapshot.todo,
      ...list.todos.slice(snapshot.index),
    ],
  };
}

/** 만든 할 일 응답으로 임시 행을 바꾼다. 그사이 다시 받아 임시 행이 사라졌으면 서버 행이 없을 때만 끝에 붙인다 */
export function withTodoSaved(
  list: TodoListResult,
  optimisticId: number,
  saved: Todo,
): TodoListResult {
  if (list.todos.some((todo) => todo.id === optimisticId)) {
    return withTodoUpdated(list, optimisticId, () => saved);
  }
  if (list.todos.some((todo) => todo.id === saved.id)) {
    return list;
  }
  return withTodoAdded(list, saved);
}

export function withTodoCreated(overview: TodoOverview): TodoOverview {
  return overview.hasTodo ? overview : { ...overview, hasTodo: true };
}

export function withTodoCompleted(overview: TodoOverview): TodoOverview {
  return overview.hasCompletedTodo ? overview : { ...overview, hasCompletedTodo: true };
}

export function snapshotTodo(
  queryClient: QueryClient,
  { date, todoId }: { date: DateKey; todoId: number },
): TodoSnapshot | null {
  const todos = getCachedTodosByDate(queryClient, { date }) ?? [];
  const index = todos.findIndex((todo) => todo.id === todoId);
  const todo = todos[index];

  if (todo == null) {
    return null;
  }

  return { date, todo, index };
}

/**
 * 캐시에 있는 그 할 일. 보고 있는 날짜 목록 → 상세 → 다른 날짜 목록 순으로 찾는다.
 * 알림으로 연 상세처럼 그날 목록이 없어도 원래 값으로 되돌리고 기간을 안다
 */
export function findCachedTodo(
  queryClient: QueryClient,
  { date, todoId }: { date?: DateKey; todoId: number },
): Todo | null {
  const isTarget = (todo: Todo) => todo.id === todoId;
  return (
    (date == null ? undefined : getCachedTodosByDate(queryClient, { date })?.find(isTarget)) ??
    queryClient.getQueryData(TODO_QUERY_KEYS.detail({ todoId }))?.todo ??
    queryClient
      .getQueriesData<TodoListResult>({ queryKey: TODO_QUERY_KEYS.lists() })
      .flatMap(([, data]) => data?.todos ?? [])
      .find(isTarget) ??
    null
  );
}

/** 그 날짜 목록에 지금 보이는 할 일. 아직 불러오지 않았으면 undefined */
export function getCachedTodosByDate(
  queryClient: QueryClient,
  { date }: { date: DateKey },
): Todo[] | undefined {
  return queryClient.getQueryData(TODO_QUERY_KEYS.listByDate({ date }))?.todos;
}

/** 이미 불러온 모든 날짜의 할 일 제목. 따로 요청하지 않는다 */
export function getCachedTodoTitles(queryClient: QueryClient): string[] {
  // 접두사로 고르면 키에 데이터 타입이 없어 TanStack 문서대로 제네릭으로 밝힌다
  return queryClient
    .getQueriesData<TodoListResult>({ queryKey: TODO_QUERY_KEYS.lists() })
    .flatMap(([, data]) => (data?.todos ?? []).map((todo) => todo.title));
}

export function updateCachedTodo(
  queryClient: QueryClient,
  { date, todoId }: { date: DateKey; todoId: number },
  update: (todo: Todo) => Todo,
) {
  queryClient.setQueryData(
    TODO_QUERY_KEYS.listByDate({ date }),
    (old) => old && withTodoUpdated(old, todoId, update),
  );
  queryClient.setQueryData(
    TODO_QUERY_KEYS.detail({ todoId }),
    (old) => old && { ...old, todo: update(old.todo) },
  );
}

export function appendTodoToList(
  queryClient: QueryClient,
  { date }: { date: DateKey },
  todo: Todo,
) {
  queryClient.setQueryData(
    TODO_QUERY_KEYS.listByDate({ date }),
    (old) => old && withTodoAdded(old, todo),
  );
}

export function saveCreatedTodo(
  queryClient: QueryClient,
  { date, optimisticId }: { date: DateKey; optimisticId: number },
  saved: Todo,
) {
  queryClient.setQueryData(
    TODO_QUERY_KEYS.listByDate({ date }),
    (old) => old && withTodoSaved(old, optimisticId, saved),
  );
}

export function removeTodoFromList(
  queryClient: QueryClient,
  { date, todoId }: { date: DateKey; todoId: number },
) {
  queryClient.setQueryData(
    TODO_QUERY_KEYS.listByDate({ date }),
    (old) => old && withTodoRemoved(old, todoId),
  );
}

export function restoreTodo(queryClient: QueryClient, snapshot: TodoSnapshot) {
  queryClient.setQueryData(
    TODO_QUERY_KEYS.listByDate({ date: snapshot.date }),
    (old) => old && withTodoRestored(old, snapshot),
  );
}

export function updateCachedTodoOverview(
  queryClient: QueryClient,
  update: (overview: TodoOverview) => TodoOverview,
) {
  queryClient.setQueryData(TODO_QUERY_KEYS.overview(), (old) => old && update(old));
}

/** 증감 대신 목록에서 계산해 낙관적 반영·되돌리기가 같다. 목록이 잘려 있으면(서버 한도 초과) 서버 값을 기다린다 */
export function syncDailyCompletionWithList(queryClient: QueryClient, { date }: { date: DateKey }) {
  const list = queryClient.getQueryData(TODO_QUERY_KEYS.listByDate({ date }));
  if (list == null || list.hasNext) {
    return;
  }
  queryClient.setQueriesData<DailyCompletionsResult>(
    completionRangesFilter({ startDate: date, endDate: date }),
    (old) => old && DailyCompletionPolicy.withTodoDailyCompletion(old, date, list.todos),
  );
}

function isDateInSpan(date: string, span: DateSpan) {
  return span.startDate <= date && date <= span.endDate;
}

// 접두사로 고른 조회는 키 끝 조각의 모양이 섞여 있어 스키마로 읽는다
function getKeyDate(queryKey: QueryKey) {
  return todoDateQueryKeySchema.safeParse(last(queryKey)).data?.date;
}

function getKeyRange(queryKey: QueryKey): DateSpan | undefined {
  return todoRangeQueryKeySchema.safeParse(last(queryKey)).data;
}

/** 접두사로 고르면 목록과 달력 범위가 섞여 데이터 모양을 확인하고 읽는다 */
function showsTodo(query: Pick<Query, 'state'>, todoId: number) {
  const { data } = query.state;
  const todos: readonly unknown[] =
    typeof data === 'object' && data != null && 'todos' in data && Array.isArray(data.todos)
      ? data.todos
      : [];
  return todos.some(
    (todo) => typeof todo === 'object' && todo != null && 'id' in todo && todo.id === todoId,
  );
}

/** 그 기간과 하루라도 겹치는 달력·위젯 완료 범위 */
function completionRangesFilter(span: DateSpan) {
  return {
    queryKey: TODO_QUERY_KEYS.completionRanges(),
    predicate: (query: Pick<Query, 'queryKey'>) => {
      const range = getKeyRange(query.queryKey);
      return range != null && range.startDate <= span.endDate && span.startDate <= range.endDate;
    },
  };
}

function widgetSummariesFilter(span: DateSpan): InvalidateQueryFilters {
  return {
    queryKey: TODO_QUERY_KEYS.widgetSummary(),
    predicate: (query) => {
      const date = getKeyDate(query.queryKey);
      return date != null && isDateInSpan(date, span);
    },
  };
}

/** 고친 목록 말고, 같은 할 일을 보여 주거나 그 기간에 드는 다른 날짜 목록. 여러 날 할 일이 함께 바뀐다 */
function otherTodoListsFilter({ date, todoId, span }: TodoWriteTarget): InvalidateQueryFilters {
  return {
    queryKey: TODO_QUERY_KEYS.lists(),
    predicate: (query) => {
      const listDate = getKeyDate(query.queryKey);
      if (listDate == null || listDate === date) {
        return false;
      }
      return isDateInSpan(listDate, span) || (todoId != null && showsTodo(query, todoId));
    },
  };
}

/** 그 할 일을 보여 주거나 기간들 중 하나에 드는 날짜 목록. 날짜를 옮기면 옛 날짜와 새 날짜가 모두 바뀐다 */
function todoListsFilter(todoId: number, spans: readonly DateSpan[]): InvalidateQueryFilters {
  return {
    queryKey: TODO_QUERY_KEYS.lists(),
    predicate: (query) => {
      const listDate = getKeyDate(query.queryKey);
      return (
        listDate != null &&
        (spans.some((span) => isDateInSpan(listDate, span)) || showsTodo(query, todoId))
      );
    },
  };
}

/** 이 할 일을 보여 주는 목록(내 목록·친구 목록) */
function listsShowingTodoFilter(queryKey: QueryKey, todoId: number): InvalidateQueryFilters {
  return { queryKey, predicate: (query) => showsTodo(query, todoId) };
}

interface TodoWriteTarget {
  /** 낙관적으로 고친 목록의 날짜. 여러 날 할 일은 시작일이 아니라 보고 있는 날짜다 */
  date: DateKey;
  /** 고친 할 일. 만들기처럼 아직 서버 id가 없으면 비운다 */
  todoId?: number;
  /** 할 일이 걸친 날짜 */
  span: DateSpan;
}

/** 그 할 일의 완료를 바꾸는 쓰기. 응답 전에는 화면의 완료가 낙관적 값이라 서버는 아직 모른다 */
export function todoCompletionWritesFilter({ todoId }: { todoId: number }): MutationFilters {
  return {
    mutationKey: TODO_MUTATION_KEYS.completionWrites(),
    predicate: (mutation) => writesTodo(mutation.state.variables, todoId),
  };
}

/** 뮤테이션마다 변수 모양이 달라 todoId 칸만 확인해 읽는다 */
function writesTodo(variables: unknown, todoId: number) {
  return (
    typeof variables === 'object' &&
    variables != null &&
    'todoId' in variables &&
    variables.todoId === todoId
  );
}

/** 쓰기를 시작한 순번. 먼저 시작해 나중에 끝난 쓰기도 그 사이 다른 쓰기가 있었는지 알 수 있다 */
const todoWriteSequences = new WeakMap<QueryClient, number>();

export interface TodoWriteTicket {
  sequence: number;
  startedWithOthers: boolean;
}

function overlapsOtherWrites(queryClient: QueryClient, ticket: TodoWriteTicket | undefined) {
  return (
    ticket == null ||
    ticket.startedWithOthers ||
    (todoWriteSequences.get(queryClient) ?? 0) > ticket.sequence ||
    !isLastMutation(queryClient, TODO_MUTATION_KEYS.listWrites())
  );
}

/** 낙관적 값을 덮을 수 있는 조회만 멈춘다. 돌려준 표로 끝날 때 다른 쓰기와 겹쳤는지 가려 서버 값으로 맞출지 정한다 */
export async function beginTodoWrite(
  queryClient: QueryClient,
  {
    date,
    todoId,
    isCompletionAffected,
  }: { date: DateKey; todoId?: number; isCompletionAffected: boolean },
): Promise<TodoWriteTicket> {
  const sequence = (todoWriteSequences.get(queryClient) ?? 0) + 1;
  todoWriteSequences.set(queryClient, sequence);
  const startedWithOthers = !isLastMutation(queryClient, TODO_MUTATION_KEYS.listWrites());
  await Promise.all([
    queryClient.cancelQueries({ queryKey: TODO_QUERY_KEYS.listByDate({ date }), exact: true }),
    todoId != null &&
      queryClient.cancelQueries({ queryKey: TODO_QUERY_KEYS.detail({ todoId }), exact: true }),
    isCompletionAffected &&
      queryClient.cancelQueries(completionRangesFilter({ startDate: date, endDate: date })),
  ]);

  return { sequence, startedWithOthers };
}

/** 쓰기마다 낡음만 표시하고, 겹친 쓰기의 재조회가 뒤 낙관적 값을 덮지 않게 마지막 쓰기만 화면에 붙은 낡은 조회를 다시 받는다 */
async function settleTodoQueries(
  queryClient: QueryClient,
  filters: readonly InvalidateQueryFilters[],
) {
  // 콜백 안에서 먼저 센다. 무효 표시를 기다리는 사이 이 쓰기가 끝나 빠지면 남은 쓰기를 마지막으로 잘못 본다
  const isLastWrite = isLastMutation(queryClient, TODO_MUTATION_KEYS.listWrites());
  await Promise.all(
    filters.map((filter) => queryClient.invalidateQueries({ ...filter, refetchType: 'none' })),
  );
  if (!isLastWrite) {
    return;
  }
  await queryClient.refetchQueries({
    queryKey: TODO_QUERY_KEYS.all,
    type: 'active',
    predicate: (query) => query.state.isInvalidated,
  });
}

interface SettleTodoWriteOptions extends TodoWriteTarget {
  /** 완료 기록(달력·위젯 요약)까지 바뀌는지 */
  isCompletionAffected: boolean;
  /** 실패해 되돌렸거나 낙관적으로 쓰지 못했는지 */
  hasFailed: boolean;
  /** `beginTodoWrite`가 돌려준 표. 낙관적으로 쓰기 전에 실패했으면 없다 */
  ticket: TodoWriteTicket | undefined;
  /** 이 쓰기만 아는 다른 할 일 조회(존재 여부 등) */
  extra?: readonly InvalidateQueryFilters[];
}

/** 서버 응답으로 확정된 낙관적 값은 다시 받지 않고, 클라이언트가 계산하지 못한 값만 다시 맞춘다 */
export function settleTodoWrite(
  queryClient: QueryClient,
  { isCompletionAffected, hasFailed, ticket, extra = [], ...target }: SettleTodoWriteOptions,
) {
  const needsReconcile = hasFailed || overlapsOtherWrites(queryClient, ticket);
  const filters: InvalidateQueryFilters[] = [otherTodoListsFilter(target), ...extra];
  if (needsReconcile) {
    filters.push({ queryKey: TODO_QUERY_KEYS.listByDate({ date: target.date }), exact: true });
    if (target.todoId != null) {
      filters.push({ queryKey: TODO_QUERY_KEYS.page({ todoId: target.todoId }) });
    }
  }
  if (isCompletionAffected) {
    // 하루짜리를 다 불러온 목록에서 계산했으면 달력 값이 서버와 같다
    const list = queryClient.getQueryData(TODO_QUERY_KEYS.listByDate({ date: target.date }));
    const isSingleDay = target.span.startDate === target.span.endDate;
    if (needsReconcile || !isSingleDay || list == null || list.hasNext) {
      filters.push(completionRangesFilter(target.span));
    }
    filters.push(widgetSummariesFilter(target.span));
  }

  return settleTodoQueries(queryClient, filters);
}

/** 서버가 정한 순서를 다시 받는다. 화면은 끌어 놓은 순서를 새 응답이 올 때까지 붙잡는다 */
export function settleTodoReorder(queryClient: QueryClient, { todoId }: { todoId: number }) {
  return settleTodoQueries(queryClient, [
    listsShowingTodoFilter(TODO_QUERY_KEYS.lists(), todoId),
    { queryKey: TODO_QUERY_KEYS.widgetSummary() },
  ]);
}

function isSameSpan(a: DateSpan, b: DateSpan) {
  return a.startDate === b.startDate && a.endDate === b.endDate;
}

/** 반복 묶음이 아닌 할 일 하나를 고친 뒤 전·후 값으로 바뀐 조회만 맞춘다(TanStack "Updates from Mutation Responses"). 고치기 전 값을 모르면 옛 날짜를 몰라 넓게 맞춘다 */
export function settleTodoEdit(
  queryClient: QueryClient,
  { before, after }: { before: Todo | null; after: Todo },
) {
  if (before == null) {
    return invalidateTodos(queryClient);
  }
  queryClient.setQueryData(
    TODO_QUERY_KEYS.detail({ todoId: after.id }),
    (old) => old && { ...old, todo: after },
  );
  const beforeSpan = getTodoDateSpan(before);
  const afterSpan = getTodoDateSpan(after);
  const spans = isSameSpan(beforeSpan, afterSpan) ? [afterSpan] : [beforeSpan, afterSpan];
  const isCategoryChanged = before.category.id !== after.category.id;
  const isCalendarChanged =
    !isSameSpan(beforeSpan, afterSpan) || before.category.color !== after.category.color;
  const filters: InvalidateQueryFilters[] = [
    todoListsFilter(after.id, spans),
    ...spans.map(widgetSummariesFilter),
    ...(isCalendarChanged ? spans.map(completionRangesFilter) : []),
    ...getRepeatOverviewFilters(before),
  ];
  if (isCategoryChanged) {
    invalidateTodoCategories(queryClient);
  }
  invalidateTodoDependentQueries(queryClient);
  return settleTodoQueries(queryClient, filters);
}

/** 완료를 풀거나 지우면 완료한 할 일·할 일·진행 중 반복이 남았는지 서버만 안다 */
export function getTodoOverviewFilters(): InvalidateQueryFilters[] {
  return [{ queryKey: TODO_QUERY_KEYS.overview() }];
}

/** 반복 회차를 고치면 규칙이 끝났는지(3개월 반복 안내)는 서버만 안다 */
function getRepeatOverviewFilters(todo: Todo | null): InvalidateQueryFilters[] {
  return todo != null && TodoPolicy.isRecurringTodo(todo) ? getTodoOverviewFilters() : [];
}

function isTodoDependentQuery(query: Pick<Query, 'meta'>) {
  return query.meta?.refreshOnTodoChange === true;
}

/** 할 일이 바뀌면 보이는 값이 달라지는 다른 피처의 조회(콕 상태 등)를 다시 불러온다. */
export function invalidateTodoDependentQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ predicate: isTodoDependentQuery });
}

/** 반복 묶음·일정 이동·다른 피처의 일괄 생성처럼 바뀐 날짜를 모를 때 내 할 일을 다시 맞춘다. 친구 조회는 내 할 일과 무관하다 */
export function invalidateTodos(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.lists() }),
    queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.pages() }),
    queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.completions() }),
    invalidateTodoCategories(queryClient),
    invalidateTodoDependentQueries(queryClient),
  ]);
}

/**
 * 지운 할 일의 상세는 다시 받아도 없어 버린다. 보고 있는 상세는 버리면 다시 받다 경계로 내려가므로
 * 화면을 떠날 때까지 두고 다시 받지도 않는다
 */
export function removeTodoPage(queryClient: QueryClient, { todoId }: { todoId: number }) {
  queryClient.removeQueries({ queryKey: TODO_QUERY_KEYS.page({ todoId }), type: 'inactive' });
}

export function invalidateTodoDetails(queryClient: QueryClient, { todoId }: { todoId: number }) {
  return queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.detail({ todoId }) });
}

/** 순서처럼 완료와 무관하게 홈 위젯 요약에 보이는 값이 바뀐 뒤 위젯 요약만 다시 불러온다. */
export function invalidateWidgetSummary(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.widgetSummary() });
}

/** 댓글 수처럼 목록·친구 목록·상세에 함께 보이는 할 일 요약 값을, 그 할 일을 보여 주는 조회만 다시 불러온다. */
export async function invalidateTodoSummaries(
  queryClient: QueryClient,
  { todoId }: { todoId: number },
): Promise<void> {
  await Promise.all([
    invalidateTodoDetails(queryClient, { todoId }),
    queryClient.invalidateQueries(listsShowingTodoFilter(TODO_QUERY_KEYS.lists(), todoId)),
    queryClient.invalidateQueries(listsShowingTodoFilter(TODO_QUERY_KEYS.friendLists(), todoId)),
  ]);
}

export function invalidateFriendTodos(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.friendLists() });
}

/** 피드의 할 일 목록과 완료 통계를 다시 불러온다. 보이는 날짜는 바로, 이미 받은 다른 날짜는 다시 볼 때 받는다. 당겨서 새로고침과 사용자 차단 뒤에 쓴다 */
export function invalidateFeedTodos(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.lists() }),
    queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.completions() }),
  ]);
}

/** 카테고리 이름·색을 함께 보여 주는 할 일 행·달력 점·상세를 다시 불러온다 */
export function invalidateCategorizedTodos(queryClient: QueryClient) {
  return Promise.all([invalidateFeedTodos(queryClient), invalidateTodoPages(queryClient)]);
}

/** 카테고리 이름·색처럼 할 일 상세 화면에 함께 보이는 값이 바뀐 뒤 열린 상세를 다시 불러온다 */
export function invalidateTodoPages(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.pages() });
}
