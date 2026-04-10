/** 단문 프롬프트(parse-todo, suggestion 등) 최대 길이 */
const MAX_SHORT_PROMPT_LENGTH = 200;

/** 장문 프롬프트(parse-memo) 최대 길이 */
const MAX_MEMO_PROMPT_LENGTH = 1000;

/**
 * AI 프롬프트 삽입용 공통 새니타이징
 *
 * 방어 레이어:
 * 1. Unicode 정규화 (NFKC) — 전각 문자(＃→#) 등을 ASCII로 통합하여 필터 우회 방지
 * 2. 줄바꿈 → 공백 — 프롬프트 구조 파괴(새 지시 삽입) 방지
 * 3. 따옴표 제거 — 인용부호 탈출 방지 (프롬프트에서 "..." 감싸기 때문)
 * 4. 마크다운/특수 문자 제거 — 헤딩(#), 리스트(-*), 인용(>), 코드(`), 취소선(~)
 * 5. 길이 제한 — 토큰 낭비 방지
 */
function sanitize(input: string, maxLength: number): string {
	return input
		.normalize("NFKC")
		.replace(/[\r\n]+/g, " ")
		.replace(/["'\\]/g, "")
		.replace(/[#\-*>`~]/g, "")
		.trim()
		.slice(0, maxLength);
}

/**
 * 단문 입력 새니타이징 (parse-todo, suggestion 등)
 *
 * @param input 사용자 입력 (최대 200자로 잘림)
 */
export function sanitizeForPrompt(input: string): string {
	return sanitize(input, MAX_SHORT_PROMPT_LENGTH);
}

/**
 * 장문 메모 입력 새니타이징 (parse-memo)
 *
 * @param input 메모 내용 (최대 1000자로 잘림)
 */
export function sanitizeMemoForPrompt(input: string): string {
	return sanitize(input, MAX_MEMO_PROMPT_LENGTH);
}
