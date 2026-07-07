import dayjs from "dayjs";

export interface TimeContext {
	datetime: string;
	fourWeeksLater: string;
	thisWeekSun: string;
	nextWeekMon: string;
	nextWeekSat: string;
	nextWeekSun: string;
	nextNextWeekMon: string;
	nextNextWeekSun: string;
	remainingDays: string[];
}

export function buildTimeContext(
	tz: string,
	now: Date,
	locale: "ko" | "en" = "ko",
): TimeContext {
	const localNow = dayjs(now).tz(tz);
	const todayDayIdx = localNow.day();
	const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

	return {
		datetime: localNow.locale(locale).format("YYYY-MM-DD HH:mm (dddd)"),
		fourWeeksLater: localNow.add(4, "week").format("YYYY-MM-DD"),
		thisWeekSun: localNow.day(todayDayIdx === 0 ? 0 : 7).format("YYYY-MM-DD"),
		nextWeekMon: localNow.day(todayDayIdx === 0 ? 1 : 8).format("YYYY-MM-DD"),
		nextWeekSat: localNow.day(todayDayIdx === 0 ? 6 : 13).format("YYYY-MM-DD"),
		nextWeekSun: localNow.day(todayDayIdx === 0 ? 7 : 14).format("YYYY-MM-DD"),
		nextNextWeekMon: localNow
			.day(todayDayIdx === 0 ? 8 : 15)
			.format("YYYY-MM-DD"),
		nextNextWeekSun: localNow
			.day(todayDayIdx === 0 ? 14 : 21)
			.format("YYYY-MM-DD"),
		remainingDays:
			todayDayIdx === 0 ? ["SUN"] : dayNames.slice(todayDayIdx).concat("SUN"),
	};
}

export function buildTimeRulesText(ctx: TimeContext): string {
	return `현재 시각: ${ctx.datetime}

기본 규칙:
- 날짜가 없으면 오늘(today)로 설정합니다.
- 시간이 없으면 종일 일정(isAllDay: true)으로 설정합니다.
- "당장", "지금", "바로" → 오늘로 설정합니다.

시간 해석:
- 새벽, 오전, 아침 → AM 시간대
- 낮, 오후, 저녁, 밤 → PM 시간대
- 점심, 정오 → 12:00
- 자정 → 00:00
- N시 반 → N:30
- N시간 후 → 현재 시각 + N시간

지난 시간 처리:
- 날짜 없이 시간만 언급 + 이미 지난 시간 → 내일로 설정
- 날짜가 명시된 경우("오늘 3시") → 그대로 유지

날짜 표현:
- 오늘 → today
- 내일 → +1일
- 모레, 이틀 후 → +2일
- 글피, 사흘 후 → +3일
- 나흘 후 → +4일
- N일 후 → +N일, N주 후 → +N주, N달 후 → +N개월
- 다음 달 → +1개월, 재다음 달 → +2개월, 내년 → 다음 해

요일 처리:
- 요일만 언급 → 아직 안 지났으면 이번 주, 지났으면 다음 주
- "이번 주 X요일" → 이번 주 해당 요일
- "다음 주 X요일" → 다음 주 해당 요일
- 요일 약어: 월=MON, 화=TUE, 수=WED, 목=THU, 금=FRI, 토=SAT, 일=SUN
- 월수금 → MON+WED+FRI, 화목 → TUE+THU, 평일 → MON~FRI

날짜 표현식:
- M월 D일 → 해당 날짜 (지났으면 내년)
- 이번 달 N일 → 해당 일 (지났으면 다음 달)
- 월초 → 1일, 월말 → 해당 월 마지막 날
- 연초 → 1월 1일, 연말 → 12월 31일

주 단위 기간 (★반드시 isRecurring: true 사용):
- "이번 주" → daysOfWeek: 오늘~일요일, endDate: ${ctx.thisWeekSun}
- "다음 주" → daysOfWeek: MON~SUN, startDate: ${ctx.nextWeekMon}, endDate: ${ctx.nextWeekSun}
- "다다음 주" → daysOfWeek: MON~SUN, startDate: ${ctx.nextNextWeekMon}, endDate: ${ctx.nextNextWeekSun}
- "이번/다음 주말" → SAT+SUN
- "주중" → MON~FRI
- 단, 단발성 이벤트(출장, 여행, 시험, 행사) → isRecurring: false + startDate~endDate

기간 범위:
- "~까지" → endDate 설정 (startDate=today)
- 날짜 + "부터~까지" → startDate + endDate
- "N일/주 동안" → endDate = start + N

반복 일정:
- 매주 → isRecurring: true + 해당 요일
- 매일 → MON~SUN
- 매주 주말 → SAT+SUN
- 매주 평일 → MON~FRI
- "매주" 종료일 미지정 시 recurrence.endDate: ${ctx.fourWeeksLater} (4주 후)
- 기간이 명시된 경우("한 달간 매주") → recurrence.endDate = 시작 + 해당 기간

이번 주 남은 요일: ${JSON.stringify(ctx.remainingDays)}`;
}

/**
 * buildTimeRulesText의 영어 버전 — 영어 자연어 시간 표현 해석 규칙.
 * 날짜 산식(ctx)은 한국어 버전과 동일하다.
 */
export function buildTimeRulesTextEn(ctx: TimeContext): string {
	return `Current time: ${ctx.datetime}

Base rules:
- If no date is given, use today.
- If no time is given, make it an all-day item (isAllDay: true).
- "right now", "immediately", "asap" → today.

Time interpretation:
- early morning, morning, AM → AM hours
- noon, lunch → 12:00
- afternoon, evening, night, PM → PM hours
- midnight → 00:00
- half past N → N:30
- in N hours → current time + N hours

Past-time handling:
- Time only (no date) and the time already passed today → schedule for tomorrow
- Explicit date given ("today at 3pm") → keep as is

Date expressions:
- today → today
- tomorrow → +1 day
- the day after tomorrow → +2 days
- in N days → +N days, in N weeks → +N weeks, in N months → +N months
- next month → +1 month, next year → next year

Weekday handling:
- Weekday only → this week if it hasn't passed yet, otherwise next week
- "this Friday" → this week's Friday
- "next Friday" → next week's Friday
- Codes: Mon=MON, Tue=TUE, Wed=WED, Thu=THU, Fri=FRI, Sat=SAT, Sun=SUN
- "Mon/Wed/Fri" → MON+WED+FRI, "weekdays" → MON~FRI

Date expressions (calendar):
- "March 5th" → that date (next year if already passed)
- "the 5th" → that day this month (next month if already passed)
- "beginning of the month" → the 1st, "end of the month" → last day of the month
- "beginning of the year" → Jan 1, "end of the year" → Dec 31

Week-long periods (★must use isRecurring: true):
- "this week" → daysOfWeek: today through Sunday, endDate: ${ctx.thisWeekSun}
- "next week" → daysOfWeek: MON~SUN, startDate: ${ctx.nextWeekMon}, endDate: ${ctx.nextWeekSun}
- "the week after next" → daysOfWeek: MON~SUN, startDate: ${ctx.nextNextWeekMon}, endDate: ${ctx.nextNextWeekSun}
- "this/next weekend" → SAT+SUN
- "during the week" → MON~FRI
- Exception: one-off events (trip, exam, conference) → isRecurring: false + startDate~endDate

Date ranges:
- "by/until X" → set endDate (startDate=today)
- date + "from ~ to" → startDate + endDate
- "for N days/weeks" → endDate = start + N

Recurring:
- "every week" → isRecurring: true + those weekdays
- "every day" → MON~SUN
- "every weekend" → SAT+SUN
- "every weekday" → MON~FRI
- "every ..." with no end date → recurrence.endDate: ${ctx.fourWeeksLater} (4 weeks out)
- Explicit duration ("every week for a month") → recurrence.endDate = start + that duration

Remaining days this week: ${JSON.stringify(ctx.remainingDays)}`;
}
