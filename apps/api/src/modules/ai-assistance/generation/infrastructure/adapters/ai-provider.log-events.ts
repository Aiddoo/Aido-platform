/**
 * 공급자 호출 경계의 이벤트. 업체·모델 ID·상태 기호만 남기고 프롬프트·응답 본문은 남기지 않는다.
 * 회로 열림·닫힘은 공용 정책의 `outbound.circuit.*`(policy `ai:<업체>`)로 남는다.
 */
export const AiProviderLogEvent = {
  FALLBACK: "ai-assistance.provider.fallback",
} as const;
