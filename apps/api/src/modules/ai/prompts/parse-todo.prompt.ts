import { format } from "date-fns";
import { ko } from "date-fns/locale";

/**
 * 최적화된 투두 파싱 프롬프트
 *
 * 토큰 최적화: ~200 토큰 (기존 ~800 토큰에서 75% 절감)
 * - 불필요한 예시 제거
 * - 핵심 규칙만 유지
 * - 간결한 포맷
 */

/**
 * 투두 파싱 프롬프트 생성
 *
 * @param text 사용자 입력 텍스트
 * @param now 현재 시간 (기본값: new Date())
 * @returns 최적화된 프롬프트 문자열
 */
export function buildParseTodoPrompt(
	text: string,
	now: Date = new Date(),
): string {
	const datetime = format(now, "yyyy-MM-dd HH:mm (EEEE)", { locale: ko });

	return `Korean Todo Parser. Now: ${datetime}
Time: 오전/아침→AM, 오후/저녁/밤→PM, 숫자만→context기반(지난시간=PM)
Date: 내일→+1d, 모레→+2d, 다음주→+7d, 이번주→this week
JSON: {"title":"string","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD|null","scheduledTime":"HH:mm|null","isAllDay":boolean}
Parse: "${text}"`;
}
