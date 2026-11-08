export const TODO_QUERY_KEYS = {
  all: ['todo'] as const,

  completions: () => [...TODO_QUERY_KEYS.all, 'completion'] as const,
  // 위젯 요약·존재 여부와 데이터 모양이 달라 낙관적 갱신이 이 범위만 고르도록 따로 묶는다
  completionRanges: () => [...TODO_QUERY_KEYS.completions(), 'range'] as const,
  completionsByRange: ({ startDate, endDate }: { startDate: string; endDate: string }) =>
    [...TODO_QUERY_KEYS.completionRanges(), { startDate, endDate }] as const,

  // 홈 위젯 요약. completions() 하위라 토글·생성·삭제의 invalidation을 그대로 상속한다
  widgetSummary: () => [...TODO_QUERY_KEYS.completions(), 'widget-summary'] as const,
  widgetSummaryByDate: ({ date, userId }: { date: string; userId?: string | null }) =>
    [...TODO_QUERY_KEYS.widgetSummary(), { date, userId: userId ?? null }] as const,

  // 할 일·완료한 할 일이 있는지(시작 체크리스트) — completions() 하위라 생성·토글·삭제 invalidation을 상속한다
  existence: () => [...TODO_QUERY_KEYS.completions(), 'existence'] as const,

  // 다가오는 반복 할 일이 있는지(3개월 안내) — 위와 같이 생성·토글·삭제 invalidation을 상속한다
  upcomingRepeat: ({ date }: { date: string }) =>
    [...TODO_QUERY_KEYS.completions(), 'upcoming-repeat', { date }] as const,

  lists: () => [...TODO_QUERY_KEYS.all, 'list'] as const,
  listByDate: ({ date }: { date: string }) => [...TODO_QUERY_KEYS.lists(), { date }] as const,

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
    [...TODO_QUERY_KEYS.page({ todoId }), 'details'] as const,
} as const;
