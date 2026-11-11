import { defineAlerts } from "#api/shared/application/alerts/define-alerts";

export const BroadcastAlerts = defineAlerts("operations", {
  DELIVERY_EXHAUSTED: {
    key: "operations.broadcast.delivery-exhausted",
    severity: "error",
    summary: "수신자 현지 시각 브로드캐스트 발송이 재시도를 다 써 일부가 받지 못했다",
    runbook:
      "태그 campaignId의 발송 결과와 같은 시각 푸시 경보를 본다. 필요하면 남은 대상에게 다시 보낸다.",
  },
});
