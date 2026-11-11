import { defineAlerts } from "#api/shared/application/alerts/define-alerts";

export const AuthAlerts = defineAlerts("identity", {
  REFRESH_TOKEN_REUSED: {
    key: "identity.session.refresh-token-reused",
    severity: "warning",
    summary: "이미 바꾼 refresh token이 다시 쓰여 그 로그인 묶음을 모두 끊었다",
    runbook:
      "한두 건은 앱의 늦은 재시도일 수 있다. 같은 사용자가 되풀이하거나 여러 사용자가 한꺼번에 오면 토큰 유출을 의심하고 SecurityLog의 SUSPICIOUS_ACTIVITY를 본다.",
  },
});
