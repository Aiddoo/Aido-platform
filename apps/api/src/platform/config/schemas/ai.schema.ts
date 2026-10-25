import { z } from "zod";

const modelId = z.string().trim().min(1).optional();
// TODO: 1.13.0 이전 앱 사용자가 업데이트한 뒤(v2 안정화 확인 후) v1 프롬프트 폴더와 전환 env를 제거한다
const promptVersion = z.enum(["v1", "v2"]).default("v2");
// 3.1 Flash-Lite의 minimal 지원은 live로 확인하지 못해 기본값은 low다.
const thinkingLevel = z.enum(["minimal", "low", "medium"]).default("low");

/**
 * AI 작업별 운영 설정. 값이 없으면 기본 모델(gemini-3.1-flash-lite)·v2 프롬프트·low thinking을 쓴다.
 * 모델 교체와 프롬프트 롤백을 배포 없이 env로만 할 수 있게 한다.
 */
export const aiSchema = z.object({
  AI_MODEL_PARSE_TODO: modelId,
  AI_MODEL_PARSE_MEMO: modelId,
  AI_MODEL_REPORT: modelId,
  AI_MODEL_SUGGESTION: modelId,
  AI_PROMPT_VERSION_PARSE_TODO: promptVersion,
  AI_PROMPT_VERSION_PARSE_MEMO: promptVersion,
  AI_PROMPT_VERSION_REPORT: promptVersion,
  AI_PROMPT_VERSION_SUGGESTION: promptVersion,
  AI_THINKING_PARSE_TODO: thinkingLevel,
  AI_THINKING_PARSE_MEMO: thinkingLevel,
  AI_THINKING_REPORT: thinkingLevel,
  AI_THINKING_SUGGESTION: thinkingLevel,
});

export type AiConfig = z.infer<typeof aiSchema>;
