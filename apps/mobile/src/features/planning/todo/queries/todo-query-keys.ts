import { queryOptions } from '@tanstack/react-query';

import type { DailyCompletionsResult } from '../domains/daily-completion.model';
import type { TodoDetails, TodoListResult, TodoOverview, TodoSummary } from '../domains/todo.model';

export const TODO_QUERY_KEYS = {
  all: ['todo'] as const,

  completions: () => [...TODO_QUERY_KEYS.all, 'completion'] as const,
  // 위젯 요약·존재 여부와 데이터 모양이 달라 낙관적 갱신이 이 범위만 고르도록 따로 묶는다
  completionRanges: () => [...TODO_QUERY_KEYS.completions(), 'range'] as const,
  completionsByRange: ({ startDate, endDate }: { startDate: string; endDate: string }) =>
    queryOptions<DailyCompletionsResult>({
      queryKey: [...TODO_QUERY_KEYS.completionRanges(), { startDate, endDate }],
    }).queryKey,

  // 홈 위젯 요약. completions() 하위라 토글·생성·삭제의 invalidation을 그대로 상속한다
  widgetSummary: () => [...TODO_QUERY_KEYS.completions(), 'widget-summary'] as const,
  widgetSummaryByDate: ({ date, userId }: { date: string; userId: string | null }) =>
    queryOptions<TodoSummary>({
      queryKey: [...TODO_QUERY_KEYS.widgetSummary(), { date, userId }],
    }).queryKey,

  // 할 일·완료한 할 일·진행 중 반복이 있는지(시작 체크리스트, 3개월 안내) — completions() 하위라 생성·토글·삭제 invalidation을 상속한다
  overview: () =>
    queryOptions<TodoOverview>({ queryKey: [...TODO_QUERY_KEYS.completions(), 'overview'] })
      .queryKey,

  // 날짜 목록(lists)과 따로 둬 할 일 쓰기의 날짜별 무효화·낙관적 갱신이 이 범위를 건드리지 않는다
  upcomingList: ({ startDate, endDate }: { startDate: string; endDate: string }) =>
    queryOptions<TodoListResult>({
      queryKey: [...TODO_QUERY_KEYS.all, 'upcoming', { startDate, endDate }],
    }).queryKey,

  lists: () => [...TODO_QUERY_KEYS.all, 'list'] as const,
  listByDate: ({ date }: { date: string }) =>
    queryOptions<TodoListResult>({ queryKey: [...TODO_QUERY_KEYS.lists(), { date }] }).queryKey,

  friendLists: () => [...TODO_QUERY_KEYS.all, 'friend'] as const,
  friendListByDate: ({ userId, date }: { userId: string; date: string }) =>
    queryOptions<TodoListResult>({ queryKey: [...TODO_QUERY_KEYS.friendLists(), { userId, date }] })
      .queryKey,

  friendCompletionsByRange: ({
    userId,
    startDate,
    endDate,
  }: {
    userId: string;
    startDate: string;
    endDate: string;
  }) =>
    queryOptions<DailyCompletionsResult>({
      queryKey: [...TODO_QUERY_KEYS.friendLists(), 'completion', { userId, startDate, endDate }],
    }).queryKey,

  // 할 일 상세 화면 (댓글 캐시는 todo-comment feature가 자기 키로 소유한다)
  pages: () => [...TODO_QUERY_KEYS.all, 'page'] as const,
  page: ({ todoId }: { todoId: number }) => [...TODO_QUERY_KEYS.pages(), { todoId }] as const,
  detail: ({ todoId }: { todoId: number }) =>
    queryOptions<TodoDetails>({ queryKey: [...TODO_QUERY_KEYS.page({ todoId }), 'details'] })
      .queryKey,
} as const;
