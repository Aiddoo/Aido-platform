/**
 * 한 페이지는 알림·dispatch·outbox를 한 transaction에 쓴다. 500건이면 짧게 끝나고,
 * 한 작업이 60초 안에서 페이지를 이어 가다가 남으면 다음 cursor 작업으로 넘긴다.
 * 수신자 현지 시각 발송 작업도 한 페이지 안의 사용자만 담으므로 같은 크기를 넘지 않는다.
 */
export const BROADCAST_FAN_OUT_PAGE_SIZE = 500;
export const BROADCAST_FAN_OUT_RUN_BUDGET_MS = 60_000;

/** 마케팅 발송은 거래성(리마인더·소셜, priority 10)보다 늦게 가져가도록 가장 낮은 차선이다. */
export const BROADCAST_JOB_PRIORITY = 0;
