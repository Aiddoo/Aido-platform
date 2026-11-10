// 주고받은 콕 목록의 방향. 계약의 direction 쿼리와 같은 값이다
const NUDGE_DIRECTIONS = ["received", "sent"] as const;

export type NudgeDirection = (typeof NUDGE_DIRECTIONS)[number];

// 감사 상태 저장·알림 기록을 한 번에 처리하는 친구 수
export const NUDGE_THANKS_BATCH_SIZE = 100;
