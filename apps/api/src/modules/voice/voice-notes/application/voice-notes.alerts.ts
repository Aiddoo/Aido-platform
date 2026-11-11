import { defineAlerts } from "#api/shared/application/alerts/define-alerts";

export const VoiceNoteAlerts = defineAlerts("voice", {
  DURATION_OVER_LIMIT: {
    key: "voice.note-digest.duration-over-limit",
    severity: "warning",
    summary: "앱이 보낸 녹음 길이가 등급별 한 번 상한을 넘었다(앱 타이머 우회 의심)",
    runbook:
      "1.15.1은 거절하지 않는다. 같은 사용자·앱 버전이 되풀이되는지 보고 1.15.2 거절 전환 근거로 남긴다.",
  },
});
