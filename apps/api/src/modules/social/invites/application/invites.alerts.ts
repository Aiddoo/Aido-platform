import { defineAlerts } from "#api/shared/application/alerts/define-alerts";

export const InviteAlerts = defineAlerts("social", {
  REWARD_RETRY_EXHAUSTED: {
    key: "social.invite-reward.retry-exhausted",
    severity: "error",
    summary: "초대 보상 지급이 자동 재시도를 다 썼다",
    runbook:
      "details.grantId의 지급 상태와 태그 errorCode를 보고, 원인을 고친 뒤 지급을 다시 적용한다.",
  },
});
