import { invalidateTodoCategories } from '@src/features/planning/category/queries/todo-category-cache';
import { SECOND_MS } from '@src/shared/constants/time-units';
import { addDaysToDateKey, type DateKey } from '@src/shared/date/date-key';
import { isLastMutation } from '@src/shared/query/is-last-mutation';
import { getExponentialBackoffMs } from '@src/shared/utils/get-exponential-backoff-ms';
import type {
  DefaultError,
  InvalidateQueryFilters,
  MutationFilters,
  Query,
  QueryClient,
  QueryExecuteOptions,
  QueryKey,
  QueryState,
} from '@tanstack/react-query';
import { last } from 'es-toolkit';
import { isMatching, P } from 'ts-pattern';

import {
  DailyCompletionPolicy,
  type DailyCompletionsResult,
  getCompletionMonthRange,
} from '../domains/daily-completion.model';
import { type TodoDetails, TodoDetailsPolicy } from '../domains/todo-details.model';
import { type TodoListResult, TodoListPolicy } from '../domains/todo-list.model';
import type { TodoOverview } from '../domains/todo-overview.model';
import { createTodoDateSpan, type TodoDateSpan } from '../domains/todo-schedule.model';
import { type Todo, TodoPolicy } from '../domains/todo.model';
import { todoDateQueryKeySchema, todoMonthQueryKeySchema } from '../schemas/todo-query-key.schema';
import { TODO_MUTATION_KEYS } from './todo-mutation-keys';
import { TODO_QUERY_KEYS } from './todo-query-keys';

/** 다시 열 때 먼저 보일 어제·오늘·내일 목록만 기기에 남긴다. 둘러본 다른 날짜는 콜드 스타트 복원 크기만 키운다 */
export function shouldPersistTodosByDate({ date, todayKey }: { date: DateKey; todayKey: DateKey }) {
  return addDaysToDateKey(todayKey, -1) <= date && date <= addDaysToDateKey(todayKey, 1);
}

/** 서버는 X-Timezone 기준 오늘·내일 요약만 받는다. 자정을 넘긴 뒤 아직 바뀌지 않은 날짜로는 묻지 않는다 */
export function isTodoSummaryDateRequestable({
  date,
  todayKey,
}: {
  date: DateKey;
  todayKey: DateKey;
}) {
  return date === todayKey || date === addDaysToDateKey(todayKey, 1);
}

const DATE_CATCH_UP_BASE_DELAY_MS = 5 * SECOND_MS;
const DATE_CATCH_UP_MAX_ATTEMPTS = 4;

type SummaryRefetchState = Pick<
  QueryState<{ date: DateKey }>,
  'data' | 'status' | 'dataUpdateCount' | 'errorUpdateCount'
>;

/** 서버 요약이 요청한 날짜에 닿을 때까지 몇 ms 뒤에 다시 물을지. 따라잡았거나 시도를 다 썼으면 false */
export function getTodoSummaryRefetchInterval(
  { data, status, dataUpdateCount, errorUpdateCount }: SummaryRefetchState,
  date: DateKey,
) {
  const isCaughtUp = status !== 'error' && (data == null || data.date === date);
  if (isCaughtUp) {
    return false;
  }
  const attempt = dataUpdateCount + errorUpdateCount - 1;

  return attempt < DATE_CATCH_UP_MAX_ATTEMPTS
    ? getExponentialBackoffMs(attempt, { baseMs: DATE_CATCH_UP_BASE_DELAY_MS })
    : false;
}

/** 응답 전 목록에 넣는 임시 행. 임시 id를 가진다 */
export type OptimisticTodo = Todo & { readonly optimistic: true };

export interface TodoSnapshot {
  date: DateKey;
  todo: Todo;
  index: number;
}

/** 상세 화면은 피드 날짜를 몰라 오늘이 기간 안이면 오늘 목록을, 아니면 시작일 목록을 먼저 고친다 */
export function getOptimisticListDate(todo: Todo, todayKey: DateKey): DateKey {
  return TodoPolicy.isTodoOnDate(todo, todayKey) ? todayKey : todo.startDate;
}

/** 할 일의 기간. 그날 목록도 상세도 불러오지 않았으면 보고 있는 하루로 본다 */
export function getCachedTodoDateSpan(
  queryClient: QueryClient,
  { date, todoId }: { date: DateKey; todoId: number },
): TodoDateSpan {
  const todo = findCachedTodo(queryClient, { date, todoId });
  return todo == null ? createTodoDateSpan(date, null) : TodoPolicy.getDateSpan(todo);
}

export function snapshotTodo(
  queryClient: QueryClient,
  { date, todoId }: { date: DateKey; todoId: number },
): TodoSnapshot | null {
  const list = getCachedTodoListByDate(queryClient, { date });
  if (list == null) {
    return null;
  }
  const index = list.todos.findIndex((todo) => todo.id === todoId);
  const todo = list.todos[index];

  if (todo == null) {
    return null;
  }

  return { date, todo, index };
}

/** 조회 함수가 DI Api를 써서 `useGetTodoDetailsQueryOptionsFactory`가 만든다 */
type TodoDetailsQueryOptions = QueryExecuteOptions<
  TodoDetails,
  DefaultError,
  TodoDetails,
  TodoDetails,
  ReturnType<typeof TODO_QUERY_KEYS.detail>
>;

/** 다른 기기가 바꿨을 수 있어 캐시가 신선해도 다시 받고, 같은 상세를 받는 중이면 그 요청을 함께 기다린다 */
export function fetchFreshTodoDetails(queryClient: QueryClient, options: TodoDetailsQueryOptions) {
  // 알림 [완료]가 이 값을 기다려 오프라인에 멈추거나 앱 기본 재시도(약 22초)로 늦추지 않고 바로 실패시킨다
  return queryClient.query({ ...options, staleTime: 0, networkMode: 'always', retry: false });
}

/** 상세까지 찾아 알림으로 연 상세처럼 그날 목록이 없어도 원래 값으로 되돌리고 기간을 안다 */
export function findCachedTodo(
  queryClient: QueryClient,
  { date, todoId }: { date?: DateKey; todoId: number },
): Todo | null {
  const isTarget = (todo: Todo) => todo.id === todoId;
  return (
    (date == null
      ? undefined
      : getCachedTodoListByDate(queryClient, { date })?.todos.find(isTarget)) ??
    queryClient.getQueryData(TODO_QUERY_KEYS.detail({ todoId }))?.todo ??
    queryClient
      .getQueriesData<TodoListResult>({ queryKey: TODO_QUERY_KEYS.lists() })
      .flatMap(([, data]) => data?.todos ?? [])
      .find(isTarget) ??
    null
  );
}

/** 그 날짜 목록에 지금 보이는 할 일 목록. 아직 불러오지 않았으면 undefined */
export function getCachedTodoListByDate(
  queryClient: QueryClient,
  { date }: { date: DateKey },
): TodoListResult | undefined {
  return queryClient.getQueryData(TODO_QUERY_KEYS.listByDate({ date }));
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
    (old) => old && TodoListPolicy.withTodoUpdated(old, todoId, update),
  );
  queryClient.setQueryData(
    TODO_QUERY_KEYS.detail({ todoId }),
    (old) => old && TodoDetailsPolicy.withTodo(old, update(old.todo)),
  );
}

export function appendTodoToList(
  queryClient: QueryClient,
  { date }: { date: DateKey },
  todo: Todo,
) {
  queryClient.setQueryData(
    TODO_QUERY_KEYS.listByDate({ date }),
    (old) => old && TodoListPolicy.withTodoAdded(old, todo),
  );
}

export function saveCreatedTodo(
  queryClient: QueryClient,
  { date, optimisticId }: { date: DateKey; optimisticId: number },
  saved: Todo,
) {
  queryClient.setQueryData(
    TODO_QUERY_KEYS.listByDate({ date }),
    (old) => old && TodoListPolicy.withTodoSaved(old, optimisticId, saved),
  );
}

export function removeTodoFromList(
  queryClient: QueryClient,
  { date, todoId }: { date: DateKey; todoId: number },
) {
  queryClient.setQueryData(
    TODO_QUERY_KEYS.listByDate({ date }),
    (old) => old && TodoListPolicy.withTodoRemoved(old, todoId),
  );
}

export function restoreTodo(queryClient: QueryClient, snapshot: TodoSnapshot) {
  queryClient.setQueryData(
    TODO_QUERY_KEYS.listByDate({ date: snapshot.date }),
    (old) => old && TodoListPolicy.withTodoRestored(old, snapshot),
  );
}

export function setTodoOverviewInCache(
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
    completionMonthsFilter({ startDate: date, endDate: date }),
    (old) => old && DailyCompletionPolicy.withTodoDailyCompletion(old, date, list.todos),
  );
}

function isDateInSpan(date: string, span: TodoDateSpan) {
  return span.startDate <= date && date <= span.endDate;
}

// 접두사로 고른 조회는 키 끝 조각의 모양이 섞여 있어 스키마로 읽는다
function getKeyDate(queryKey: QueryKey) {
  return todoDateQueryKeySchema.safeParse(last(queryKey)).data?.date;
}

function getKeyMonthRange(queryKey: QueryKey) {
  const month = todoMonthQueryKeySchema.safeParse(last(queryKey)).data?.month;
  return month == null ? null : getCompletionMonthRange(month);
}

/** 접두사로 고르면 목록과 달력 범위가 섞여 데이터 모양을 확인하고 읽는다 */
function showsTodo(query: Pick<Query, 'state'>, todoId: number) {
  const { data } = query.state;
  const todos = isMatching({ todos: P.array() }, data) ? data.todos : [];
  return todos.some((todo) => isMatching({ id: todoId }, todo));
}

/** 그 기간과 하루라도 겹치는 달의 완료 기록 */
function completionMonthsFilter(span: TodoDateSpan) {
  return {
    queryKey: TODO_QUERY_KEYS.completionMonths(),
    predicate: (query: Pick<Query, 'queryKey'>) => {
      const range = getKeyMonthRange(query.queryKey);
      return range != null && range.startDate <= span.endDate && span.startDate <= range.endDate;
    },
  };
}

function widgetSummariesFilter(span: TodoDateSpan): InvalidateQueryFilters {
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
function todoListsFilter(todoId: number, spans: readonly TodoDateSpan[]): InvalidateQueryFilters {
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

function listsShowingTodoFilter(queryKey: QueryKey, todoId: number): InvalidateQueryFilters {
  return { queryKey, predicate: (query) => showsTodo(query, todoId) };
}

interface TodoWriteTarget {
  /** 낙관적으로 고친 목록의 날짜. 여러 날 할 일은 시작일이 아니라 보고 있는 날짜다 */
  date: DateKey;
  /** 고친 할 일. 만들기처럼 아직 서버 id가 없으면 비운다 */
  todoId?: number;
  span: TodoDateSpan;
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
  return isMatching({ todoId }, variables);
}

// QueryClient 수명을 따르는 모듈 전역 예외다(structure.md 모듈 전역 목록)
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
      queryClient.cancelQueries(completionMonthsFilter({ startDate: date, endDate: date })),
  ]);

  return { sequence, startedWithOthers };
}

/** 겹친 쓰기의 재조회가 뒤 낙관적 값을 덮지 않게 쓰기마다 낡음만 표시하고 마지막 쓰기만 다시 받는다 */
async function settleTodoQueries(
  queryClient: QueryClient,
  filters: readonly InvalidateQueryFilters[],
  { isOutsideWrites = false }: { isOutsideWrites?: boolean } = {},
) {
  // 콜백 안에서 먼저 센다. 무효 표시를 기다리는 사이 이 쓰기가 끝나 빠지면 남은 쓰기를 마지막으로 잘못 본다
  const isLastWrite = isOutsideWrites
    ? queryClient.isMutating({ mutationKey: TODO_MUTATION_KEYS.listWrites() }) === 0
    : isLastMutation(queryClient, TODO_MUTATION_KEYS.listWrites());
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
    // 하루짜리를 다 불러온 목록에서 계산했으면 달력 값이 서버와 같다(daily-completion-cases.json이 두 계산을 고정한다)
    const list = queryClient.getQueryData(TODO_QUERY_KEYS.listByDate({ date: target.date }));
    const isSingleDay = target.span.startDate === target.span.endDate;
    if (needsReconcile || !isSingleDay || list == null || list.hasNext) {
      filters.push(completionMonthsFilter(target.span));
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

function isSameSpan(a: TodoDateSpan, b: TodoDateSpan) {
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
    (old) => old && TodoDetailsPolicy.withTodo(old, after),
  );
  const beforeSpan = TodoPolicy.getDateSpan(before);
  const afterSpan = TodoPolicy.getDateSpan(after);
  const spans = isSameSpan(beforeSpan, afterSpan) ? [afterSpan] : [beforeSpan, afterSpan];
  const isCategoryChanged = before.category.id !== after.category.id;
  const isCalendarChanged =
    !isSameSpan(beforeSpan, afterSpan) || before.category.color !== after.category.color;
  const isPermissionInputChanged =
    before.completed !== after.completed || before.visibility !== after.visibility;
  const filters: InvalidateQueryFilters[] = [
    todoListsFilter(after.id, spans),
    ...spans.map(widgetSummariesFilter),
    ...(isCalendarChanged ? spans.map(completionMonthsFilter) : []),
    ...getRepeatOverviewFilters(before),
    ...(isPermissionInputChanged ? [getTodoDetailsFilter({ todoId: after.id })] : []),
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

/** 상세 권한(감사 가능 canThank)은 서버가 완료·공개 범위로 정한다. 둘이 바뀌면 상세를 다시 받는다 */
export function getTodoDetailsFilter({ todoId }: { todoId: number }): InvalidateQueryFilters {
  return { queryKey: TODO_QUERY_KEYS.detail({ todoId }), exact: true };
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

const ALL_MY_TODO_FILTERS: readonly InvalidateQueryFilters[] = [
  { queryKey: TODO_QUERY_KEYS.lists() },
  { queryKey: TODO_QUERY_KEYS.pages() },
  { queryKey: TODO_QUERY_KEYS.completions() },
];

/** 반복 묶음을 만들거나 고쳐 바뀐 날짜를 모를 때 내 할 일을 넓게 맞춘다. 진행 중인 체크의 낙관적 값을 덮지 않게 마지막 쓰기만 다시 받는다 */
export function settleTodoSeriesWrite(queryClient: QueryClient) {
  return Promise.all([
    settleTodoQueries(queryClient, ALL_MY_TODO_FILTERS),
    invalidateTodoCategories(queryClient),
    invalidateTodoDependentQueries(queryClient),
  ]);
}

/** 바뀐 날짜를 몰라 넓게 맞추고, 진행 중인 체크가 있으면 낡음만 표시해 그 낙관적 값을 덮지 않는다 */
export function settleTodoBatchWrite(queryClient: QueryClient) {
  return Promise.all([
    // 여러 할 일을 한 번에 만들면 첫 할 일이 생겼는지(가져오기 안내 카드)도 서버만 안다
    settleTodoQueries(queryClient, [...ALL_MY_TODO_FILTERS, ...getTodoOverviewFilters()], {
      isOutsideWrites: true,
    }),
    invalidateTodoCategories(queryClient),
    invalidateTodoDependentQueries(queryClient),
  ]);
}

/** 보고 있는 상세는 버리면 다시 받다 경계로 내려가므로 화면을 떠날 때까지 두고 다시 받지도 않는다 */
export function removeTodoPage(queryClient: QueryClient, { todoId }: { todoId: number }) {
  queryClient.removeQueries({ queryKey: TODO_QUERY_KEYS.page({ todoId }), type: 'inactive' });
}

export function invalidateTodoDetails(queryClient: QueryClient, { todoId }: { todoId: number }) {
  return queryClient.invalidateQueries(getTodoDetailsFilter({ todoId }));
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

/** 친구 피드 당겨서 새로고침. 보이는 친구 할 일·완료 기록은 바로, 이미 받은 다른 날짜는 다시 볼 때 받는다 */
export function refreshFriendTodos(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.friendLists() });
}

/** 피드의 할 일 목록과 완료 통계를 다시 불러온다. 보이는 날짜는 바로, 이미 받은 다른 날짜는 다시 볼 때 받는다. 당겨서 새로고침과 사용자 차단 뒤에 쓴다 */
export function refreshFeedTodos(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.lists() }),
    queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.completions() }),
  ]);
}

/** 카테고리 이름·색을 함께 보여 주는 할 일 행·달력 점·상세를 다시 불러온다 */
export function invalidateCategorizedTodos(queryClient: QueryClient) {
  return Promise.all([refreshFeedTodos(queryClient), invalidateTodoPages(queryClient)]);
}

/** 카테고리 이름·색처럼 할 일 상세 화면에 함께 보이는 값이 바뀐 뒤 열린 상세를 다시 불러온다 */
function invalidateTodoPages(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.pages() });
}
