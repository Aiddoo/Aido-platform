import { defineAlerts } from "#api/shared/application/alerts/define-alerts";

export const QuotaAlerts = defineAlerts("access", {
  STALE_RESERVATION: {
    key: "access.quota.stale-reservation",
    severity: "error",
    summary: "돌려주지 못한 횟수 예약이 남아 사용자 한도가 월말까지 깎인다",
    runbook:
      "details의 failedCount·staleCount와 같은 시각 DB 경보를 본다. 다음 정리 주기에도 남으면 그 예약을 직접 환불한다.",
  },
});
