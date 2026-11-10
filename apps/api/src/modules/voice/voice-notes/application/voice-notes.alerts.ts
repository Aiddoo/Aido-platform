/** 녹음 정리의 운영 경보 key. key마다 Sentry 이슈 하나로 모인다. */
export const VoiceNoteAlertKey = {
  /** 앱이 보낸 녹음 길이가 등급별 한 번 상한을 허용 오차보다 넘었다. 앱 타이머 우회를 의심한다(1.15.1은 거절하지 않음). */
  DURATION_OVER_LIMIT: "voice.note-digest.duration-over-limit",
} as const;
