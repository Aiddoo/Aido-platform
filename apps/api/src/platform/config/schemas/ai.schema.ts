import { z } from "zod";

/** Gemini API 키 형식. 기존 `AIza…`와 새 `AQ.…` 키를 모두 받도록 접두사 없이 문자 집합과 길이만 본다. */
const GOOGLE_GENERATIVE_AI_API_KEY_PATTERN = /^[A-Za-z0-9._-]{30,}$/;

const modelId = z.string().trim().min(1).optional();
// TODO: 1.13.0 이전 앱 사용자가 업데이트한 뒤(v2 안정화 확인 후) v1 프롬프트 폴더와 전환 env를 제거한다
const promptVersion = z.enum(["v1", "v2"]).default("v2");
const thinkingLevel = (fallback: "minimal" | "low") =>
  z.enum(["minimal", "low", "medium"]).default(fallback);

/**
 * AI 공급자 키와 작업별 운영 설정. 값이 없으면 기본 모델(google:gemini-3.1-flash-lite)·v2 프롬프트를 쓴다.
 * 모델 값은 `<provider>:<model>`이고, provider 없이 쓴 기존 값(`gemini-…`)은 google로 읽는다.
 * AI_FALLBACK_MODEL은 기본 모델이 일시 오류(429·5xx·네트워크)로 실패했을 때만 대신 쓴다.
 * thinking 기본값은 parse-todo만 minimal이고 나머지는 low다. 2026-10-26 live eval에서 parse-todo는
 * minimal이 low와 정확도가 같고 지연이 짧았지만, parse-memo는 minimal에서 남은 할 일 수를 잘못 셌다.
 * 모델 교체와 프롬프트 롤백을 배포 없이 env로만 할 수 있게 한다.
 */
export const aiSchema = z.object({
  // Google이 키 형식을 바꾼 적이 있어(AIza… → AQ.…) 접두사는 검사하지 않는다. 빈 문자열은 미설정이다.
  GOOGLE_GENERATIVE_AI_API_KEY: z
    .string()
    .optional()
    .refine((val) => !val || GOOGLE_GENERATIVE_AI_API_KEY_PATTERN.test(val), {
      message:
        "GOOGLE_GENERATIVE_AI_API_KEY must be at least 30 characters of [A-Za-z0-9._-] without whitespace",
    }),
  AI_MODEL_PARSE_TODO: modelId,
  AI_MODEL_PARSE_MEMO: modelId,
  AI_MODEL_REPORT: modelId,
  AI_MODEL_SUGGESTION: modelId,
  AI_FALLBACK_MODEL: modelId,
  AI_PROMPT_VERSION_PARSE_TODO: promptVersion,
  AI_PROMPT_VERSION_PARSE_MEMO: promptVersion,
  AI_PROMPT_VERSION_REPORT: promptVersion,
  AI_PROMPT_VERSION_SUGGESTION: promptVersion,
  AI_THINKING_PARSE_TODO: thinkingLevel("minimal"),
  AI_THINKING_PARSE_MEMO: thinkingLevel("low"),
  AI_THINKING_REPORT: thinkingLevel("low"),
  AI_THINKING_SUGGESTION: thinkingLevel("low"),
});

export type AiConfig = z.infer<typeof aiSchema>;

export const AI_CONFIG_KEYS = aiSchema.keyof().options;
