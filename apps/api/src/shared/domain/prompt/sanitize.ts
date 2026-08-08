/** 단문 프롬프트(parse-todo, suggestion 등) 최대 길이 */
const MAX_SHORT_PROMPT_LENGTH = 200;

/** 장문 프롬프트(parse-memo) 최대 길이 */
const MAX_MEMO_PROMPT_LENGTH = 1000;

/**
 * 단문 입력 새니타이징 (parse-todo, suggestion 등)
 *
 * 방어 레이어:
 * 1. Unicode NFKC 정규화
 * 2. 줄바꿈 → 공백
 * 3. 길이 제한
 *
 * 문맥을 이루는 기호(C#, 제네릭, 경로, 인용부호)는 제거하지 않습니다.
 * 프롬프트 경계 보호는 문자열 훼손이 아니라 encodeUntrustedJson에서 담당합니다.
 */
export function sanitizeForPrompt(input: string): string {
	return input
		.normalize("NFKC")
		.replace(/[\r\n]+/g, " ")
		.trim()
		.slice(0, MAX_SHORT_PROMPT_LENGTH);
}

/**
 * 장문 메모 입력 새니타이징 (parse-memo)
 *
 * 메모의 리스트·문단·코드 표현을 보존합니다.
 */
export function sanitizeMemoForPrompt(input: string): string {
	return input
		.normalize("NFKC")
		.replace(/\r\n?/g, "\n")
		.trim()
		.slice(0, MAX_MEMO_PROMPT_LENGTH);
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
