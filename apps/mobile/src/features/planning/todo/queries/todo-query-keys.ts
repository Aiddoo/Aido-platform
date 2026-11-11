import { queryOptions } from '@tanstack/react-query';

import type { DailyCompletionsResult } from '../domains/daily-completion.model';
import type {
  TodoDetails,
  TodoExistence,
  TodoListResult,
  TodoSummary,
} from '../domains/todo.model';

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
  widgetSummaryByDate: ({ date, userId }: { date: string; userId?: string | null }) =>
    queryOptions<TodoSummary>({
      queryKey: [...TODO_QUERY_KEYS.widgetSummary(), { date, userId: userId ?? null }],
    }).queryKey,

  // 할 일·완료한 할 일이 있는지(시작 체크리스트) — completions() 하위라 생성·토글·삭제 invalidation을 상속한다
  existence: () =>
    queryOptions<TodoExistence>({ queryKey: [...TODO_QUERY_KEYS.completions(), 'existence'] })
      .queryKey,

  // 다가오는 반복 할 일이 있는지(3개월 안내) — 위와 같이 생성·토글·삭제 invalidation을 상속한다
  upcomingRepeats: () => [...TODO_QUERY_KEYS.completions(), 'upcoming-repeat'] as const,
  upcomingRepeat: ({ date }: { date: string }) =>
    [...TODO_QUERY_KEYS.upcomingRepeats(), { date }] as const,

  lists: () => [...TODO_QUERY_KEYS.all, 'list'] as const,
  listByDate: ({ date }: { date: string }) =>
    queryOptions<TodoListResult>({ queryKey: [...TODO_QUERY_KEYS.lists(), { date }] }).queryKey,

  friendLists: () => [...TODO_QUERY_KEYS.all, 'friend'] as const,
  friendListByDate: ({ userId, date }: { userId: string; date: string }) =>
    [...TODO_QUERY_KEYS.friendLists(), { userId, date }] as const,

  friendCompletionsByRange: ({
    userId,
    startDate,
    endDate,
  }: {
    userId: string;
    startDate: string;
    endDate: string;
  }) => [...TODO_QUERY_KEYS.friendLists(), 'completion', { userId, startDate, endDate }] as const,

  // 할 일 상세 화면 (댓글 캐시는 todo-comment feature가 자기 키로 소유한다)
  pages: () => [...TODO_QUERY_KEYS.all, 'page'] as const,
  page: ({ todoId }: { todoId: number }) => [...TODO_QUERY_KEYS.pages(), { todoId }] as const,
  detail: ({ todoId }: { todoId: number }) =>
    queryOptions<TodoDetails>({ queryKey: [...TODO_QUERY_KEYS.page({ todoId }), 'details'] })
      .queryKey,
} as const;
