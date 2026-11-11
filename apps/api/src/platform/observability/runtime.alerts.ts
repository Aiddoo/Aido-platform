import { defineAlerts } from "#api/shared/application/alerts/define-alerts";

export const RuntimeAlerts = defineAlerts("runtime", {
  POOL_WAITING_SUSTAINED: {
    key: "runtime.pool.waiting-sustained",
    severity: "warning",
    summary: "DB 커넥션 풀 대기가 기준 시간 넘게 이어진다",
    runbook:
      "/health runtime.pool과 RDS 연결 수·CPU를 본다. pg_stat_statements로 느린 쿼리와 긴 트랜잭션을 찾는다.",
  },
  EVENT_LOOP_DELAY_HIGH: {
    key: "runtime.event-loop.delay-high",
    severity: "warning",
    summary: "이벤트 루프 지연 p99가 기준을 넘었다",
    runbook:
      "같은 시각 배치·대량 발송과 CPU를 본다. 되풀이되면 그 작업을 나누거나 동시성을 줄인다.",
  },
  HEAP_USAGE_HIGH: {
    key: "runtime.heap.usage-high",
    severity: "warning",
    summary: "힙 사용률이 기준을 넘었다",
    runbook:
      "/health runtime의 heap·rss 추세를 본다. 계속 오르면 누수를 의심해 최근 배포를 되돌리고 컨테이너를 재시작한다.",
  },
});
