/** 공급자 호출 경계의 이벤트. 모델 ID·상태 코드 같은 고정 기호만 남기고 프롬프트·응답 본문은 남기지 않는다. */
export const AiProviderLogEvent = {
  FALLBACK: "ai.provider.fallback",
  MODEL_UNRESOLVED: "ai.provider.model_unresolved",
} as const;
