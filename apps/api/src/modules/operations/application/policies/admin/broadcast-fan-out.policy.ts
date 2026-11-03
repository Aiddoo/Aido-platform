/**
 * 한 페이지는 알림·dispatch·outbox를 한 transaction에 쓴다. 500건이면 짧게 끝나고,
 * 한 작업이 60초 안에서 페이지를 이어 가다가 남으면 다음 cursor 작업으로 넘긴다.
 */
export const BROADCAST_FAN_OUT_POLICY = {
  pageSize: 500,
  runBudgetMs: 60_000,
} as const;
