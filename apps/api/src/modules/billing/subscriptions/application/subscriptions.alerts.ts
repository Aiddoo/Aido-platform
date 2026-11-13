import { defineAlerts } from "#api/shared/application/alerts/define-alerts";

export const SubscriptionAlerts = defineAlerts("billing", {
  WEBHOOK_PROCESSING_FAILED: {
    key: "billing.subscription.webhook.processing-failed",
    severity: "error",
    summary: "결제 공급자 웹훅을 영구 실패로 닫아 구독 상태가 반영되지 않았다",
    runbook:
      "태그 storeEnvironment가 SANDBOX면 넘긴다. details.eventId로 결제 공급자 대시보드의 고객 이력과 사용자 권한을 맞춰 보고, 고친 뒤 이벤트를 다시 보내거나 대조 작업을 기다린다.",
  },
  WEBHOOK_INVALID: {
    key: "billing.subscription.webhook.invalid",
    severity: "warning",
    summary: "계약과 다른 결제 공급자 웹훅 원문을 받아 처리하지 않았다",
    runbook:
      "태그 eventType과 issueCount로 공급자 웹훅 형식 변경인지 보고 공급자 어댑터의 웹훅 Zod 스키마를 고친다.",
  },
  RECONCILE_FAILED: {
    key: "billing.subscription.reconcile.failed",
    severity: "error",
    summary: "구독 스토어 상태 대조가 재시도 뒤에도 실패했다",
    runbook:
      "결제 공급자 API 키 권한·만료와 공급자 상태 페이지를 확인한다. 실패한 사용자는 다음 대조 주기에 다시 돈다.",
  },
});
