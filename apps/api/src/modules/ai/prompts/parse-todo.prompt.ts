import dayjs from "dayjs";

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
 * @param timezone 사용자 타임존 (IANA, 기본값: "UTC")
 * @param now 현재 시간 (기본값: new Date())
 * @returns 최적화된 프롬프트 문자열
 */
export function buildParseTodoPrompt(
	text: string,
	tz: string = "UTC",
	now: Date = new Date(),
): string {
	const datetime = dayjs(now)
		.tz(tz)
		.locale("ko")
		.format("YYYY-MM-DD HH:mm (dddd)");
	const fourWeeksLater = dayjs(now).tz(tz).add(4, "week").format("YYYY-MM-DD");

	return `Korean Todo Parser. Now: ${datetime}
Time: 오전/아침→AM, 오후/저녁/밤→PM, 숫자만→context기반(지난시간=PM)
Date: 내일→+1d, 모레→+2d, 다음주→+7d, 이번주→this week
Repeat: 매주→isRecurring:true+요일, 매일→MON~SUN, 주말→SAT+SUN, 평일→MON~FRI, 격주/매달→isRecurring:false
JSON: {"title":"str","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD|null","scheduledTime":"HH:mm|null","isAllDay":bool,"isRecurring":bool,"recurrence":{"daysOfWeek":["MON"],"endDate":"${fourWeeksLater}"}|null}
Parse: "${text}"`;
}
