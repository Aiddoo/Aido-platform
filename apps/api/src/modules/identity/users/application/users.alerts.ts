import { defineAlerts } from "#api/shared/application/alerts/define-alerts";

export const UserAlerts = defineAlerts("identity", {
  ACCOUNT_PURGE_FAILED: {
    key: "identity.account-purge.failed",
    severity: "error",
    summary: "탈퇴 계정 영구 삭제가 일부 실패해 보관 기한을 넘길 수 있다",
    runbook:
      "identity.account-purge.user.failed 로그의 userId·errorType으로 원인(FK·잠금)을 고친다. 다음 날 03시 배치가 다시 지우는지 확인하고, 이틀 넘게 남으면 직접 삭제한다.",
  },
});
