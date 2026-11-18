import { VOICE_NOTE_RETENTION_DAYS } from "@aido/api/vocabulary";

// 앱이 적용 요청을 말로 메모와 함께 이 기간 남겨 다시 보낼 수 있다. 그 뒤의 적용 기록은 지운다
export function planApplicationRetentionCutoff(now: Temporal.Instant): Temporal.Instant {
  return now.subtract({ hours: VOICE_NOTE_RETENTION_DAYS * 24 });
}
