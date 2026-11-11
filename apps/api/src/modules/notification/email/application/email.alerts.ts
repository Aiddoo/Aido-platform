import { defineAlerts } from "#api/shared/application/alerts/define-alerts";

export const EmailAlerts = defineAlerts("notification", {
  DELIVERY_UNSEAL_FAILED: {
    key: "notification.email.delivery-unseal-failed",
    severity: "error",
    summary: "발송 큐의 이메일을 풀지 못해 버렸다",
    runbook:
      "최근 암호화 키 교체나 롤백이 있었는지 본다. 버린 인증·문의 메일은 사용자가 다시 요청해야 한다.",
  },
  CIRCUIT_OPEN: {
    key: "notification.email.circuit-open",
    severity: "error",
    summary: "이메일 공급자 호출이 연속 실패해 발송을 잠시 멈췄다",
    runbook:
      "Resend 상태 페이지와 API 키를 확인한다. 회로는 1분 뒤 다시 시험하고 큐의 메일은 pg-boss 재시도로 이어진다.",
  },
  DAILY_BUDGET_NEAR: {
    key: "notification.email.daily-budget-near",
    severity: "warning",
    summary: "오늘 이메일 발송 수가 무료 한도 경고 기준에 닿았다",
    runbook: "가입 급증인지 남용인지 notification.email 로그로 보고, 계속 늘면 요금제를 검토한다.",
  },
  MONTHLY_BUDGET_NEAR: {
    key: "notification.email.monthly-budget-near",
    severity: "warning",
    summary: "이번 달 이메일 발송 수가 무료 한도 경고 기준에 닿았다",
    runbook: "남은 일수로 한도를 넘을지 가늠하고, 넘을 것 같으면 요금제 상향을 준비한다.",
  },
  BUDGET_EXHAUSTED: {
    key: "notification.email.budget-exhausted",
    severity: "warning",
    summary: "이메일 발송 예산을 다 써서 메일을 보내지 못했다",
    runbook:
      "인증 메일이 막혀 가입이 멈춘다. 원인을 본 뒤 요금제와 EMAIL_SEND_BUDGET 상수를 함께 올린다.",
  },
  PROVIDER_QUOTA_EXHAUSTED: {
    key: "notification.email.provider-quota-exhausted",
    severity: "error",
    summary: "이메일 공급자가 발송 한도를 넘었다고 거절했다",
    runbook:
      "Resend 대시보드 사용량을 확인한다. 한도가 풀릴 때까지 메일이 막히므로 요금제를 검토한다.",
  },
  DELIVERY_REJECTED: {
    key: "notification.email.delivery-rejected",
    severity: "error",
    summary: "이메일 공급자가 다시 보내도 소용없다고 거절해 메일을 버렸다",
    runbook: "태그 reason을 보고 Resend API 키와 발신 도메인 DNS 인증을 확인한다.",
  },
  DELIVERY_RETRY_EXHAUSTED: {
    key: "notification.email.delivery-retry-exhausted",
    severity: "error",
    summary: "이메일을 재시도 끝에도 보내지 못했다",
    runbook: "같은 시각 이메일 회로 경보와 Resend 장애를 먼저 본다. 사용자는 다시 요청해야 한다.",
  },
});
