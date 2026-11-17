/** 업체를 부르기 전 방어선(입력 상한·킬 스위치·비용 예산)의 이벤트. 금액은 micro-USD다. */
export const AiGuardLogEvent = {
  INPUT_REJECTED: "ai-assistance.generation.input.rejected",
  SPEND_HALTED: "ai-assistance.spend.halted",
  SPEND_USER_LIMITED: "ai-assistance.spend.user.limited",
  SPEND_THRESHOLD_REACHED: "ai-assistance.spend.threshold.reached",
  SPEND_READ_FAILED: "ai-assistance.spend.read.failed",
  SPEND_RECORD_FAILED: "ai-assistance.spend.record.failed",
} as const;
