/** 프롬프트에 삽입될 사용자 입력의 최대 길이 */
const MAX_PROMPT_INPUT_LENGTH = 200;

/**
 * AI 프롬프트에 삽입될 사용자 입력을 새니타이징합니다.
 *
 * - 줄바꿈 → 공백 (프롬프트 구조 파괴 방지)
 * - 마크다운 메타문자 제거 (헤딩/리스트 등 인젝션 방지)
 * - 길이 제한 (토큰 낭비 방지)
 */
export function sanitizeForPrompt(input: string): string {
	return input
		.replace(/[\r\n]+/g, " ")
		.replace(/[#\-*>`~]/g, "")
		.trim()
		.slice(0, MAX_PROMPT_INPUT_LENGTH);
}
