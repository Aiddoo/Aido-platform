import dayjs from "dayjs";

/** 메모 프롬프트에 삽입될 메모 내용의 최대 길이 */
const MAX_MEMO_PROMPT_LENGTH = 1000;

/**
 * 메모 내용을 AI 프롬프트 삽입용으로 새니타이징합니다.
 *
 * - 프롬프트 인젝션 위험 문자(`#`, `` ` ``, `>`, `~`) 제거
 * - 줄바꿈/목록 기호(`-`, `*`, 숫자)는 유지 (AI가 구조를 파악할 수 있도록)
 * - 연속 빈 줄(3줄+)만 축소
 * - 길이 제한 (토큰 낭비 방지, 메모용 1000자)
 */
export function sanitizeMemoForPrompt(input: string): string {
	return input
		.replace(/[#>`~]/g, "")
		.replace(/\n{3,}/g, "\n\n")
		.trim()
		.slice(0, MAX_MEMO_PROMPT_LENGTH);
}

/**
 * 메모 → 다중 Todo+SubTodo 파싱 프롬프트 생성
 *
 * 기존 parse-todo.prompt.ts의 날짜/시간 규칙을 재사용하되,
 * 메모 전용 로직(다중 Todo 추출, SubTodo 분해)을 추가합니다.
 *
 * @param content 메모 내용
 * @param tz 사용자 타임존 (IANA, 기본값: "UTC")
 * @param now 현재 시간
 * @returns 최적화된 프롬프트 문자열
 */
export function buildParseMemoPrompt(
	content: string,
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
	const nextWeekSun = localNow
		.day(localNow.day() === 0 ? 7 : 14)
		.format("YYYY-MM-DD");
	const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
	const todayDayIdx = localNow.day();
	const remainingDays =
		todayDayIdx === 0 ? ["SUN"] : dayNames.slice(todayDayIdx).concat("SUN");

	const safeContent = sanitizeMemoForPrompt(content);

	return `Korean Memo→Todos Parser. Now: ${datetime}

TASK: 메모에서 독립적인 할 일을 1-5개 추출. 각 할 일에 실행 가능한 세부 단계가 있으면 items(서브투두) 0-5개 추출.
SPLIT: 별개 맥락/주제→별도 Todo. 하나의 큰 작업+세부단계→1 Todo+여러 items.
TITLE: 핵심 행동만 간결하게. 조사/접속사/감탄사 제거.
ITEMS: 구체적이고 실행 가능한 단계만. "잘 하기" 같은 추상적 표현 금지. 단순 메모(우유 사기 등)는 items 비워둘 것.

TIME RULES:
Default: 날짜없음→today, 시간없음→isAllDay:true, 당장/지금/바로→today
Time: 새벽/오전/아침→AM, 낮/오후/저녁/밤→PM, 점심/정오→12:00, 자정→00:00, N시반→N:30, N시간후→now+Nh
PastTime: 날짜없이시간만+이미지남→내일, 날짜명시→유지
Date: 오늘→today, 내일→+1d, 모레→+2d, 글피→+3d, N일후→+Nd, N주후→+Nw, N달후→+Nmo
Week: 요일만→이번주(미래)/다음주(지남), 이번주X→this week, 다음주X→next week
DayAbbr: 월=MON,화=TUE,수=WED,목=THU,금=FRI,토=SAT,일=SUN
DateExpr: M월D일→해당날짜(지났으면내년), 월초→1일, 월말→말일
WeekSpan(★isRecurring:true): 이번주→daysOfWeek:today~SUN,endDate=${thisWeekSun}, 다음주→MON~SUN,start=${nextWeekMon},endDate=${nextWeekSun}
Range: ~까지→endDate(start=today), N일/주동안→endDate=start+N
Repeat: 매주→isRecurring:true+요일, 매일→MON~SUN, 매주주말→SAT+SUN, 매주평일→MON~FRI
Remaining weekdays: ${JSON.stringify(remainingDays)}

JSON: {"todos":[{"title":"str","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD|null","scheduledTime":"HH:mm|null","isAllDay":bool,"isRecurring":bool,"recurrence":{"daysOfWeek":["MON"],"endDate":"${fourWeeksLater}"}|null,"items":[{"title":"str"}]}]}

MEMO: "${safeContent}"`;
}
