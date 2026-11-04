/** AI 생성의 운영 경보 key. key마다 Sentry 이슈 하나로 모인다. */
export const AiAlertKey = {
  /** 결제·인증 실패로 업체를 건너뛰기 시작했다. 크레딧·키를 확인해야 한다. */
  PROVIDER_BILLING_CIRCUIT_OPENED: "ai.provider.billing-circuit-opened",
  /** 추정 비용이 경고·배경 중단·전체 중단 기준선에 닿았다(기간당 한 번). */
  SPEND_THRESHOLD_REACHED: "ai.spend.threshold-reached",
} as const;
