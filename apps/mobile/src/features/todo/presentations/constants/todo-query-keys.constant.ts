export const TODO_QUERY_KEYS = {
  all: ['todo'] as const,

  // 범위 쿼리 (캘린더 뷰: 한 달/한 주 전체 데이터)
  ranges: () => [...TODO_QUERY_KEYS.all, 'range'] as const,
  byRange: (start: string, end: string) => [...TODO_QUERY_KEYS.ranges(), start, end] as const,

  // Daily Completion (캘린더 달성 표시)
  completions: () => [...TODO_QUERY_KEYS.all, 'completion'] as const,
  completionsByRange: (start: string, end: string) =>
    [...TODO_QUERY_KEYS.completions(), start, end] as const,

  // 무한 스크롤 리스트 (선택된 날짜의 상세 목록)
  lists: () => [...TODO_QUERY_KEYS.all, 'list'] as const,
  listByDate: (date: string) => [...TODO_QUERY_KEYS.lists(), date] as const,
  listByDateAndCategory: (date: string, categoryId: number) =>
    [...TODO_QUERY_KEYS.lists(), date, 'category', categoryId] as const,

  // 친구 할 일 목록 (단일 요청 + 카테고리 그룹핑)
  friendLists: () => [...TODO_QUERY_KEYS.all, 'friend'] as const,
  friendListByDate: (userId: string, date: string) =>
    [...TODO_QUERY_KEYS.friendLists(), userId, date] as const,
} as const;
