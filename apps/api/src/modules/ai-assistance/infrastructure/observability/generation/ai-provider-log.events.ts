/**
 * 공급자 호출 경계의 이벤트. 업체·모델 ID·상태 기호만 남기고 프롬프트·응답 본문은 남기지 않는다.
 * 회로 열림·닫힘은 공용 정책의 `outbound.circuit.*`(policy `ai:<업체>`)로 남는다.
 */
export const AiProviderLogEvent = {
  FALLBACK: "ai.provider.fallback",
} as const;

/** 업체를 부르기 전 방어선(입력 상한·킬 스위치·비용 예산)의 이벤트. 금액은 micro-USD다. */
export const AiGuardLogEvent = {
  INPUT_REJECTED: "ai.generation.input-rejected",
  SPEND_HALTED: "ai.spend.halted",
  SPEND_USER_LIMITED: "ai.spend.user-limited",
  SPEND_THRESHOLD_REACHED: "ai.spend.threshold-reached",
  SPEND_READ_FAILED: "ai.spend.read-failed",
  SPEND_RECORD_FAILED: "ai.spend.record-failed",
} as const;
