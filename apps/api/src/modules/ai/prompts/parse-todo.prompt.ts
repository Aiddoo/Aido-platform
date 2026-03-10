import dayjs from "dayjs";
import { sanitizeForPrompt } from "./sanitize";

/**
 * 최적화된 투두 파싱 프롬프트
 *
 * 토큰 최적화: ~320-350 토큰
 * - 한국어 자연어의 다양한 날짜/기간/요일 표현 커버
 * - 핵심 규칙만 유지
 * - 간결한 포맷
 */

/**
 * 투두 파싱 프롬프트 생성
 *
 * @param text 사용자 입력 텍스트
 * @param timezone 사용자 타임존 (IANA, 기본값: "UTC")
 * @param now 현재 시간 (기본값: now())
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
	const safeText = sanitizeForPrompt(text);

	return `Korean Todo Parser. Now: ${datetime}
Default: 날짜없음→today, 시간없음→isAllDay:true, 당장/지금/바로→today
Time: 새벽/오전/아침→AM, 낮/오후/저녁/밤→PM, 점심/정오→12:00, 자정→00:00, N시반→N:30, 숫자만→context(지난시간→PM)
PastTime: 날짜없이시간만+이미지남→내일, 날짜명시("오늘")→유지
Date: 오늘→today, 내일→+1d, 모레/이틀후→+2d, 글피/사흘후→+3d, 나흘후→+4d, N일후→+Nd, N주후→+Nw, N달후→+Nmo, 다음달→+1mo, 내년→next year
Week: 요일만→이번주(미래면)/다음주(지났으면), 이번주X요일→this week, 다음주X요일→next week, 이번주→this week, 다음주→+7d, 다다음주→+14d
DateExpr: M월D일→해당날짜(지났으면내년), 이번달N일→해당일(지났으면다음달), 다음달N일→next month, 월초→1일(지났으면다음달), 월말→말일, 연초→1/1, 연말→12/31
Range: ~까지→endDate(startDate=today), ~부터~까지→startDate+endDate, N일/주동안→endDate=start+N
NonRepeat: 이번/다음주말→토요일(isRecurring:false)
Repeat: 매주→isRecurring:true+요일, 매일→MON~SUN, 매주주말→SAT+SUN, 매주평일→MON~FRI, 격주/격일/매달→isRecurring:false
Compound: 반복+기간→recurrence.endDate=시작+기간
Title: 날짜/시간표현 제외, 핵심내용만
JSON: {"title":"str","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD|null","scheduledTime":"HH:mm|null","isAllDay":bool,"isRecurring":bool,"recurrence":{"daysOfWeek":["MON"],"endDate":"${fourWeeksLater}"}|null}
Parse: "${safeText}"`;
}
