export const TODO_QUERY_KEYS = {
  all: ['todo'] as const,

  // Daily Completion (캘린더 달성 표시)
  completions: () => [...TODO_QUERY_KEYS.all, 'completion'] as const,
  completionsByRange: ({ startDate, endDate }: { startDate: string; endDate: string }) =>
    [...TODO_QUERY_KEYS.completions(), { startDate, endDate }] as const,

  // 홈 위젯 요약 — completions() 하위에 중첩해 토글/생성/삭제 뮤테이션의
  // 기존 completions() invalidation을 그대로 상속받는다 (추가 배선 불필요)
  widgetSummary: () => [...TODO_QUERY_KEYS.completions(), 'widget-summary'] as const,
  widgetSummaryByDate: ({ date, userId }: { date: string; userId?: string | null }) =>
    [...TODO_QUERY_KEYS.widgetSummary(), { date, userId: userId ?? null }] as const,

  // 할 일·완료한 할 일이 있는지(시작 체크리스트) — completions() 하위라 생성·토글·삭제 invalidation을 상속한다
  existence: () => [...TODO_QUERY_KEYS.completions(), 'existence'] as const,

  // 선택된 날짜의 할 일 목록
  lists: () => [...TODO_QUERY_KEYS.all, 'list'] as const,
  listByDate: ({ date }: { date: string }) => [...TODO_QUERY_KEYS.lists(), { date }] as const,

  // 친구 할 일 목록 (단일 요청 + 카테고리 그룹핑)
  friendLists: () => [...TODO_QUERY_KEYS.all, 'friend'] as const,
  friendListByDate: ({ userId, date }: { userId: string; date: string }) =>
    [...TODO_QUERY_KEYS.friendLists(), { userId, date }] as const,

  // 친구 일일 완료 현황 (친구 캘린더 달성 표시 — PUBLIC 기준)
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
  details: ({ todoId }: { todoId: number }) =>
    [...TODO_QUERY_KEYS.page({ todoId }), 'details'] as const,
} as const;
