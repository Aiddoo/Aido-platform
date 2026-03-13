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
	const localNow = dayjs(now).tz(tz);
	const thisWeekSun = localNow
		.day(localNow.day() === 0 ? 0 : 7)
		.format("YYYY-MM-DD");
	const nextWeekMon = localNow
		.day(localNow.day() === 0 ? 1 : 8)
		.format("YYYY-MM-DD");
	const nextWeekSat = localNow
		.day(localNow.day() === 0 ? 6 : 13)
		.format("YYYY-MM-DD");
	const nextWeekSun = localNow
		.day(localNow.day() === 0 ? 7 : 14)
		.format("YYYY-MM-DD");
	const nextNextWeekMon = localNow
		.day(localNow.day() === 0 ? 8 : 15)
		.format("YYYY-MM-DD");
	const nextNextWeekSun = localNow
		.day(localNow.day() === 0 ? 14 : 21)
		.format("YYYY-MM-DD");
	const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
	const todayDayIdx = localNow.day();
	const remainingDays =
		todayDayIdx === 0 ? ["SUN"] : dayNames.slice(todayDayIdx).concat("SUN");
	const safeText = sanitizeForPrompt(text);

	return `Korean Todo Parser. Now: ${datetime}
Default: 날짜없음→today, 시간없음→isAllDay:true, 당장/지금/바로→today
Time: 새벽/오전/아침→AM, 낮/오후/저녁/밤→PM, 점심/정오→12:00, 자정→00:00, N시반→N:30, 숫자만→context(지난시간→PM), N시간후→now+Nh, N분후→now+Nm
PastTime: 날짜없이시간만+이미지남→내일, 날짜명시("오늘")→유지
Date: 오늘→today, 내일→+1d, 모레/이틀후→+2d, 글피/사흘후→+3d, 나흘후→+4d, N일후→+Nd, N주후→+Nw, N달후→+Nmo, 다음달→+1mo, 재다음달→+2mo, 내년→next year
Week: 요일만→이번주(미래면)/다음주(지났으면), 이번주X요일→this week, 다음주X요일→next week
DayAbbr: 월=MON,화=TUE,수=WED,목=THU,금=FRI,토=SAT,일=SUN. 월수금→MON+WED+FRI, 화목→TUE+THU, 월화수목금→MON~FRI
DateExpr: M월D일→해당날짜(지났으면내년), 이번달N일→해당일(지났으면다음달), 다음달N일→next month, 월초→1일(지났으면다음달), 월말→말일, 연초→1/1, 연말→12/31
WeekSpan(★MUST isRecurring:true): 이번주/다음주/다다음주/주말/주중/요일부터~까지→반드시 isRecurring:true+daysOfWeek 사용. 이번주→daysOfWeek:today요일~SUN,endDate=이번주SUN, 다음주→MON~SUN,start=다음주MON,endDate=다음주SUN, 다다음주→MON~SUN,start=다다음주MON,endDate=다다음주SUN, 이번/다음주말→SAT+SUN, 주중→이번주평일MON~FRI,endDate=이번주FRI, X요일부터Y요일까지→daysOfWeek:X~Y. 단,단발성(출장/여행/시험/행사)→isRecurring:false+startDate~endDate
WeekSpanEx1: "이번주 운동"(today=${datetime.slice(0, 10)})→{"title":"운동","startDate":"${datetime.slice(0, 10)}","endDate":null,"scheduledTime":null,"isAllDay":true,"isRecurring":true,"recurrence":{"daysOfWeek":${JSON.stringify(remainingDays)},"endDate":"${thisWeekSun}"}}
WeekSpanEx2: "다음주 회의"→{"title":"회의","startDate":"${nextWeekMon}","endDate":null,"scheduledTime":null,"isAllDay":true,"isRecurring":true,"recurrence":{"daysOfWeek":["MON","TUE","WED","THU","FRI","SAT","SUN"],"endDate":"${nextWeekSun}"}}
WeekSpanEx3: "다음주말 영화"→{"title":"영화","startDate":"${nextWeekSat}","endDate":null,"scheduledTime":null,"isAllDay":true,"isRecurring":true,"recurrence":{"daysOfWeek":["SAT","SUN"],"endDate":"${nextWeekSun}"}}
WeekSpanEx4: "다다음주 발표"→{"title":"발표","startDate":"${nextNextWeekMon}","endDate":null,"scheduledTime":null,"isAllDay":true,"isRecurring":true,"recurrence":{"daysOfWeek":["MON","TUE","WED","THU","FRI","SAT","SUN"],"endDate":"${nextNextWeekSun}"}}
Range(날짜전용,요일은WeekSpan): ~까지→endDate(startDate=today), 날짜+부터~까지→startDate+endDate, N일/주동안→endDate=start+N
Repeat: 매주→isRecurring:true+요일, 매일→MON~SUN, 매주주말→SAT+SUN, 매주평일→MON~FRI, 격주/격일→isRecurring:false,startDate=today,isAllDay:true(시스템미지원), 매달/매월N일→isRecurring:false,startDate=당월N일(지났으면다음달),isAllDay:true(시스템미지원)
Compound: 반복+기간→recurrence.endDate=시작+기간, N월+요일약어→isRecurring:true,daysOfWeek=해당요일들,startDate=N월1일(지났으면내년),recurrence.endDate=N월말일
Title: 날짜/시간표현 제외, 핵심내용만
JSON: {"title":"str","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD|null","scheduledTime":"HH:mm|null","isAllDay":bool,"isRecurring":bool,"recurrence":{"daysOfWeek":["MON"],"endDate":"${fourWeeksLater}"}|null}
Parse: "${safeText}"`;
}
