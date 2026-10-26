import { AI_PARSE_LIMITS, MEMO_LIMITS } from "@aido/api/vocabulary";

import { truncateGraphemes } from "../utils/grapheme.util.js";

/**
 * 단문 입력 새니타이징 (parse-todo, suggestion 등)
 *
 * 방어 레이어:
 * 1. Unicode NFKC 정규화
 * 2. 줄바꿈 → 공백
 * 3. 길이 제한 (요청 계약과 같은 상한, 문자 경계 보존)
 *
 * 문맥을 이루는 기호(C#, 제네릭, 경로, 인용부호)는 제거하지 않습니다.
 * 프롬프트 경계 보호는 문자열 훼손이 아니라 encodeUntrustedJson에서 담당합니다.
 */
export function sanitizeForPrompt(
  input: string,
  maxLength: number = AI_PARSE_LIMITS.TODO_TEXT_MAX_LENGTH,
): string {
  return truncateGraphemes(
    input
      .normalize("NFKC")
      .replace(/[\r\n]+/g, " ")
      .trim(),
    maxLength,
  );
}

/**
 * 장문 메모 입력 새니타이징 (parse-memo)
 *
 * 메모의 리스트·문단·코드 표현을 보존합니다. 요청 계약 길이까지 잘라내지 않습니다.
 */
export function sanitizeMemoForPrompt(input: string): string {
  return truncateGraphemes(
    input.normalize("NFKC").replace(/\r\n?/g, "\n").trim(),
    MEMO_LIMITS.MAX_CONTENT_LENGTH,
  );
}

/**
 * 신뢰할 수 없는 값을 JSON으로 직렬화하고 XML 유사 프롬프트 경계를 보호합니다.
 * JSON.parse 시 원래 값이 완전히 복원되므로 사용자 의미를 손상하지 않습니다.
 */
export function encodeUntrustedJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
