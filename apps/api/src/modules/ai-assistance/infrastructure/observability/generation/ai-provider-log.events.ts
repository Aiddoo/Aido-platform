/** 공급자 호출 경계의 이벤트. 업체·모델 ID·상태 기호만 남기고 프롬프트·응답 본문은 남기지 않는다. */
export const AiProviderLogEvent = {
  FALLBACK: "ai.provider.fallback",
  CIRCUIT_OPENED: "ai.provider.circuit.opened",
  CIRCUIT_HALF_OPEN: "ai.provider.circuit.half-open",
  CIRCUIT_CLOSED: "ai.provider.circuit.closed",
} as const;
