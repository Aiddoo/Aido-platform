import { defineAlerts } from "#api/shared/application/alerts/define-alerts";

export const AiAlerts = defineAlerts("ai", {
  MODEL_PRICING_UNKNOWN: {
    key: "ai.spend.model-pricing-unknown",
    severity: "error",
    summary: "가격표에 없는 AI 모델이 설정돼 비용을 최고 단가로 잡는다",
    runbook:
      "details.providers의 모델 설정을 확인하고 ai-model-pricing.constants.ts에 단가를 더하거나 모델 설정을 되돌린다.",
  },
  PROVIDER_BILLING_CIRCUIT_OPENED: {
    key: "ai.provider.billing-circuit-opened",
    severity: "error",
    summary: "AI 업체 결제 실패로 그 업체를 건너뛴다",
    runbook:
      "태그 policy 업체 콘솔에서 크레딧·결제 수단을 확인한다. 충전하면 쿨다운 뒤 자동으로 다시 쓴다.",
  },
  PROVIDER_AUTH_CIRCUIT_OPENED: {
    key: "ai.provider.auth-circuit-opened",
    severity: "error",
    summary: "AI 업체 인증 실패가 이어져 그 업체를 건너뛴다",
    runbook:
      "태그 policy 업체의 API 키가 만료·폐기됐는지 보고 security.md 절차로 키를 바꿔 재배포한다.",
  },
  ALL_PROVIDERS_CIRCUIT_OPEN: {
    key: "ai.provider.all-circuits-open",
    severity: "error",
    summary: "모든 AI 업체 회로가 열려 AI 기능이 실패한다",
    runbook:
      "/health의 outbound 상태와 업체 상태 페이지를 본다. 결제·인증 경보가 함께 왔으면 그것부터 풀고, 일시 장애면 쿨다운 뒤 회복을 확인한다.",
  },
  SPEND_THRESHOLD_REACHED: {
    key: "ai.spend.threshold-reached",
    severity: "warning",
    summary: "AI 추정 비용이 일·월 경고 기준선에 닿았다",
    runbook:
      "태그 window와 details 금액을 업체 청구와 비교한다. 특정 사용자·작업이 몰렸는지 ai 로그로 본다.",
  },
  SPEND_BACKGROUND_HALTED: {
    key: "ai.spend.background-halted",
    severity: "error",
    summary: "AI 비용이 배경 중단 기준에 닿아 배경 AI 작업을 멈췄다",
    runbook:
      "사용자 요청 AI는 계속 돈다. 원인을 본 뒤 더 쓸 거면 AI_BUDGET_DAILY_BACKGROUND_USD·AI_BUDGET_MONTHLY_BACKGROUND_USD를 올려 재배포한다. 다음 기간에 저절로 풀린다.",
  },
  SPEND_HALTED: {
    key: "ai.spend.halted",
    severity: "error",
    summary: "AI 비용이 전체 중단 기준에 닿아 모든 AI 생성을 멈췄다",
    runbook:
      "앱의 AI 기능이 모두 실패한다. 업체 청구와 원인을 확인하고 더 쓸 거면 AI_BUDGET_DAILY_USD·AI_BUDGET_MONTHLY_USD를 올려 재배포한다.",
  },
});
