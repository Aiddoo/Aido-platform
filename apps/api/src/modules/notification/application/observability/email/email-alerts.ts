/** 이메일 발송의 운영 경보 key. */
export const EmailAlertKey = {
  /** 이메일 공급자 호출이 연속으로 실패해 회로가 열렸다. 인증 메일이 밀린다. */
  CIRCUIT_OPEN: "notification.email.circuit-open",
  /** 오늘 발송 수가 무료 한도의 경보 기준에 닿았다. */
  DAILY_BUDGET_NEAR: "notification.email.daily-budget-near",
  /** 이번 달 발송 수가 무료 한도의 경보 기준에 닿았다. */
  MONTHLY_BUDGET_NEAR: "notification.email.monthly-budget-near",
  /** 발송 예산을 다 써서 메일을 보내지 못했다. */
  BUDGET_EXHAUSTED: "notification.email.budget-exhausted",
  /** 공급자가 일·월 발송 한도를 넘었다고 거절했다. */
  PROVIDER_QUOTA_EXHAUSTED: "notification.email.provider-quota-exhausted",
  /** 공급자가 다시 보내도 소용없다고 거절해 메일을 버렸다. 키·발신 도메인 설정을 확인해야 한다. */
  DELIVERY_REJECTED: "notification.email.delivery-rejected",
  /** 재시도를 다 써도 보내지 못했다. */
  DELIVERY_RETRY_EXHAUSTED: "notification.email.delivery-retry-exhausted",
} as const;
