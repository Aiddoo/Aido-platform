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
 * 3. 따옴표/백슬래시 제거
 * 4. 마크다운 메타 문자 제거 (리스트 불릿 `-*`과 범위 `~`는 유지)
 * 5. 길이 제한
 */
export function sanitizeForPrompt(input: string): string {
	return input
		.normalize("NFKC")
		.replace(/[\r\n]+/g, " ")
		.replace(/["'\\]/g, "")
		.replace(/[#>`]/g, "")
		.trim()
		.slice(0, MAX_SHORT_PROMPT_LENGTH);
}

/**
 * 장문 메모 입력 새니타이징 (parse-memo)
 *
 * 메모의 리스트 구조(`-`, `*`)와 범위 표현(`~`)을 보존합니다.
 * 줄바꿈은 ` ; `로 변환하여 항목 분리 신호를 유지합니다.
 */
export function sanitizeMemoForPrompt(input: string): string {
	return input
		.normalize("NFKC")
		.replace(/["'\\]/g, "")
		.replace(/^#{1,6}\s*/gm, "")
		.replace(/[>`]/g, "")
		.replace(/[\r\n]+/g, " ; ")
		.trim()
		.slice(0, MAX_MEMO_PROMPT_LENGTH);
}
