export const BroadcastAlert = {
  /** 수신자 현지 시각 발송 작업이 재시도를 다 썼다. 그 묶음의 사용자는 알림을 받지 못했다. */
  DELIVERY_EXHAUSTED: "operations.broadcast.delivery-exhausted",
} as const;
