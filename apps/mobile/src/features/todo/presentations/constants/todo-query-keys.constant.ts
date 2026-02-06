export const TODO_QUERY_KEYS = {
  all: ['todo'] as const,

  // 범위 쿼리 (캘린더 뷰: 한 달/한 주 전체 데이터)
  ranges: () => [...TODO_QUERY_KEYS.all, 'range'] as const,
  byRange: (start: string, end: string) => [...TODO_QUERY_KEYS.ranges(), start, end] as const,

  // 무한 스크롤 리스트 (선택된 날짜의 상세 목록)
  lists: () => [...TODO_QUERY_KEYS.all, 'list'] as const,
  listByDate: (date: string) => [...TODO_QUERY_KEYS.lists(), date] as const,
} as const;
