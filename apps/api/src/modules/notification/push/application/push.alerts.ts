import { defineAlerts } from "#api/shared/application/alerts/define-alerts";

export const PushAlerts = defineAlerts("notification", {
  RECEIPT_FAILURE_RATIO_HIGH: {
    key: "notification.push.receipt-failure-ratio-high",
    severity: "error",
    summary: "푸시 receipt의 공급자 쪽 실패 비율이 기준을 넘었다",
    runbook:
      "태그 topFailureKind가 PROVIDER_REJECTED면 Expo 프로젝트의 FCM·APNs 자격 증명을, RATE_LIMITED면 발송량을, PROVIDER_UNAVAILABLE면 Expo 상태 페이지를 본다.",
  },
});
