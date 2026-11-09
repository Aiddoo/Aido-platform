/**
 * 파싱·계획 프롬프트가 함께 쓰는 일정 지시 블록. 날짜를 직접 계산하지 않게 표현 종류만 기록시킨다.
 * planRepeat·planCategory는 반복 할 일과 계획(quick-plan·voice-note-digest)용이다.
 */
export const SCHEDULE_RULES_KO = {
  date: `<date_rules>
- date는 할 일을 시작하는 날의 표현이다. 날짜 표현이 없으면 kind는 NONE이고 나머지 칸은 null이다.
- 오늘, 지금, 당장, 바로 → TODAY. "오늘 아침", "오늘 밤"처럼 오늘을 말하면 때와 함께여도 TODAY다.
- 내일 → OFFSET_DAYS amount 1. 모레·이틀 후 → 2. 글피·사흘 후 → 3. "N일 후" → N.
- OFFSET_WEEKS는 "N주 후", "N주 뒤"처럼 주 수와 후/뒤를 함께 말할 때만 쓴다. "다음 달", "N달 후" → OFFSET_MONTHS N.
- 요일 → WEEKDAY와 weekday. 요일만 말하거나 "이번 주 금요일"처럼 이번 주를 붙이면 weekOffset은 null이다. "다음 주" → 1, "다다음 주" → 2. 그 요일이 이번 주에 이미 지났는지는 서버가 판단하므로 넘겨 계산하지 않는다.
- "다음 주 월요일"처럼 주와 요일을 함께 말하면 반드시 WEEKDAY와 weekOffset이다. 메모·목록의 한 줄이어도 같다: "- 다음 주 월요일 오전 10시 회의" → kind WEEKDAY, weekday MON, weekOffset 1.
- "M월 D일" → CALENDAR_DATE month M, day D. 연도는 말했을 때만 year에 쓰고 아니면 null이다. "N일", "이번 달 N일" → CALENDAR_DATE day N이고 month는 null이다.
- 월초 → MONTH_START, 월말 → MONTH_END, 연초 → YEAR_START, 연말 → YEAR_END. amount는 0이 이번, 1이 다음이다.
- M이 <context> now의 달이고 다른 해를 말하지 않았으면 "M월 초"는 MONTH_START amount 0, "M월 말"은 MONTH_END amount 0이다. 그 달의 초가 이미 지났어도 같다. 날짜 계산은 서버가 한다.
- 다른 달의 "M월 말", "M월 초"는 CALENDAR_DATE다: month M, day는 그 달의 마지막 날이나 1일이다.
- "M월 1일"처럼 날짜를 정확히 말하면 달이 같아도 CALENDAR_DATE다.
- endDate는 끝을 나타내는 표현이 있을 때만 쓰고 없으면 null이다: "~까지", "A부터 B까지", "N일 동안". "금요일까지 보고서"는 date가 NONE이고 endDate가 금요일이다.
</date_rules>`,
  time: `<time_rules>
- 시각 표현이 없으면 time은 null이다(종일 일정).
- 말한 숫자를 그대로 hour에 쓴다. "오후 3시" → hour 3, meridiem PM. "15시" → hour 15, meridiem NONE. "3시 반" → minute 30.
- 새벽·오전·아침 → AM. 오후·저녁·밤 → PM. 오전/오후 단서가 없으면 meridiem은 NONE이며 추측하지 않는다.
- 숫자 시각 없이 때만 말하면 hour·minute·relativeMinutes는 null이고 partOfDay만 쓴다: 새벽 DAWN, 아침 MORNING, 점심·정오 NOON, 오후 AFTERNOON, 저녁 EVENING, 밤 NIGHT, 자정 MIDNIGHT. "아침"이라고 hour 8처럼 시각을 지어내지 않는다. 기본 시각은 서버가 정한다.
- 때와 숫자 시각을 함께 말하면 숫자가 우선이다. "아침 7시" → hour 7, minute 0, meridiem AM, partOfDay null.
- relativeMinutes는 "N시간 후", "N분 뒤"처럼 지금부터 지날 시간을 말할 때만 1 이상의 분으로 쓰고 아니면 null이다. 0을 쓰거나 partOfDay·hour와 함께 쓰지 않는다.
</time_rules>`,
  repeat: `<repeat_rules>
- 반복이 없으면 pattern은 NONE이다.
- "매주 월수금" → WEEKLY_DAYS, daysOfWeek ["MON","WED","FRI"]. 매일 → DAILY. 평일마다 → WEEKDAYS. 주말마다 → WEEKENDS.
- "이번 주 운동", "다음 주 회의"처럼 그 주 내내 하는 일 → THIS_WEEK, NEXT_WEEK, WEEK_AFTER_NEXT. "이번 주말", "다음 주말" → THIS_WEEKEND, NEXT_WEEKEND. "이번 주 주중" → THIS_WEEKDAYS.
- 출장, 여행, 시험, 행사처럼 기간이 있는 단발 일정은 반복이 아니다. pattern은 NONE이고 date와 endDate로 기간을 나타낸다.
- 격주, 매월, 매년처럼 위 목록에 없는 반복은 UNSUPPORTED다. 이때 할 일은 한 번만 만들어지므로 말한 요일·날짜를 date에 그대로 쓴다: "격주 화요일 스터디" → date kind WEEKDAY, weekday TUE, weekOffset null. date를 NONE으로 두지 않는다.
- 반복 종료를 말했을 때만 until("다음 달 말까지") 또는 forDuration("한 달 동안" → MONTH 1)을 쓰고 아니면 둘 다 null이다. "30분 운동"처럼 한 번에 걸리는 시간은 반복 기간이 아니므로 forDuration에 쓰지 않는다.
</repeat_rules>`,
  category: `<category_rules>
- categoryId는 <context>의 categories 중 할 일과 의미가 가장 가까운 id 하나다. 어울리는 항목이 없거나 목록이 비어 있으면 null이다.
</category_rules>`,
  planRepeat: `<repeat_rules>
- 반복이 없으면 pattern은 NONE이다.
- 매일 → DAILY. 평일마다 → WEEKDAYS. "주말마다", "매주 주말"처럼 되풀이를 말했을 때만 WEEKENDS다. 되풀이를 말하지 않은 "주말에"는 다가오는 주말 한 번이라 THIS_WEEKEND다.
- "매주 월수금" → WEEKLY_DAYS, daysOfWeek ["MON","WED","FRI"]. 요일 없이 "매주"만 말하고 date에 요일이 있으면 그 요일 하나를 daysOfWeek에 쓴다.
- "격주 화요일", "2주마다 화요일" → BIWEEKLY_DAYS, daysOfWeek ["TUE"].
- "매달 15일", "매월 15일" → MONTHLY_DAY, monthDay 15. "매달 말일"은 monthDay 31이다.
- "이번 주 운동", "다음 주 회의"처럼 그 주 내내 하는 일 → THIS_WEEK, NEXT_WEEK, WEEK_AFTER_NEXT. "이번 주말", "다음 주말" → THIS_WEEKEND, NEXT_WEEKEND. "이번 주 주중" → THIS_WEEKDAYS.
- 출장, 여행, 시험, 행사처럼 기간이 있는 단발 일정은 반복이 아니다. pattern은 NONE이고 date와 endDate로 기간을 나타낸다. "다음 주 내내 출장" → date 다음 주 월요일, endDate 다음 주 일요일.
- 매년, 매월 n번째 요일, 3주 이상 간격, 시간 단위 반복은 UNSUPPORTED다. 말한 요일·날짜는 date에 그대로 쓴다.
- 반복의 요일·날짜는 daysOfWeek·monthDay에만 쓴다. date는 시작을 따로 말했을 때만 쓰고 아니면 NONE이다.
- 반복 종료를 말했을 때만 until("12월 말까지" → CALENDAR_DATE month 12, day 31) 또는 forDuration("한 달 동안" → MONTH 1)을 쓴다. 종료를 말하지 않으면 둘 다 null이다(계속 반복). 종료일을 지어내지 않는다. "30분 운동"처럼 한 번에 걸리는 시간은 반복 기간이 아니므로 forDuration에 쓰지 않는다.
- 반복 할 일은 하루짜리다. 반복이면 endDate는 null이다.
</repeat_rules>`,
  planCategory: `<category_rules>
- categoryId는 <context>의 categories 중 할 일과 의미가 가장 가까운 id 하나다. 어울리는 항목이 없거나 목록이 비어 있으면 null이다.
</category_rules>`,
} as const;

export const SCHEDULE_RULES_EN = {
  date: `<date_rules>
- date is the expression for the day the to-do starts. With no date expression, kind is NONE and every other field is null.
- today, now, right away, asap → TODAY. "this morning", "this afternoon", "tonight" also mean today → TODAY with the part of day.
- tomorrow → OFFSET_DAYS amount 1. the day after tomorrow → 2. "in N days" → N.
- Use OFFSET_WEEKS only for "in N weeks" / "N weeks from now". "next month", "in N months" → OFFSET_MONTHS N.
- A weekday → WEEKDAY with weekday. A bare weekday ("Friday", "on Friday", "this Friday") has weekOffset null. "next Friday" → weekOffset 1. "Friday after next" → weekOffset 2. The server decides whether that weekday has already passed this week, so never shift it yourself.
- "next Monday" or "Monday next week" is always WEEKDAY with weekOffset 1, never OFFSET_WEEKS, also inside a memo or list line: "- team meeting next Monday 10am" → kind WEEKDAY, weekday MON, weekOffset 1.
- "March 5", "5 March" → CALENDAR_DATE month 3, day 5. Set year only when it is stated, otherwise null. "the 5th" → CALENDAR_DATE day 5 with month null.
- start of the month → MONTH_START, end of the month → MONTH_END, start/end of the year → YEAR_START/YEAR_END. amount 0 means this one, 1 means the next one.
- When no other year is stated and the named month is the month of now in <context>, "early November" in November is MONTH_START amount 0 and "the end of November" in November is MONTH_END amount 0, even if early November has already passed. The server resolves the date.
- Any other named month ("the end of March", "early March") is CALENDAR_DATE: month 3, day is the last day of that month or 1.
- An exact date ("November 1") stays CALENDAR_DATE even in the same month.
- Use endDate only for an end expression, otherwise null: "by X", "until X", "from A to B", "for N days". "Report by Friday" has date NONE and endDate Friday.
</date_rules>`,
  time: `<time_rules>
- With no time expression, time is null (all-day).
- Put the number exactly as said in hour. "3pm" → hour 3, meridiem PM. "15:00" → hour 15, meridiem NONE. "half past 3" or "3:30" → minute 30.
- am/morning → AM. pm/afternoon/evening/tonight → PM. Without an AM/PM cue, meridiem is NONE; do not guess.
- With only a part of day and no clock time, set only partOfDay; hour, minute, and relativeMinutes are null: early morning DAWN, morning MORNING, noon/lunch NOON, afternoon AFTERNOON, evening EVENING, tonight/night NIGHT, midnight MIDNIGHT. Never invent a clock time such as hour 8 for "morning"; the server picks the default.
- When a part of day comes with a clock time, the clock time wins. "7 in the morning" → hour 7, minute 0, meridiem AM, partOfDay null.
- Use relativeMinutes only for time from now ("in N hours", "in N minutes"), as minutes of 1 or more, otherwise null. Never write 0 and never combine it with partOfDay or hour.
</time_rules>`,
  repeat: `<repeat_rules>
- Without repetition, pattern is NONE.
- "every Mon, Wed and Fri" → WEEKLY_DAYS with daysOfWeek ["MON","WED","FRI"]. every day → DAILY. every weekday → WEEKDAYS. every weekend → WEEKENDS.
- Work spread across a whole week without "every", such as "workout this week" or "meetings next week" → THIS_WEEK, NEXT_WEEK, WEEK_AFTER_NEXT. "this weekend", "next weekend" → THIS_WEEKEND, NEXT_WEEKEND. "during the week" → THIS_WEEKDAYS.
- One-off events that span days (business trip, vacation, exam, conference) are not repetition: pattern NONE, with the span in date and endDate.
- Repetition not listed above (every other week, monthly, yearly) → UNSUPPORTED. The to-do is created only once, so keep the stated weekday or date in date: "study group every other Tuesday" → date kind WEEKDAY, weekday TUE, weekOffset null. Never leave date NONE here.
- Use until ("until the end of next month") or forDuration ("for a month" → MONTH 1) only when the end of the repetition is stated, otherwise both are null. How long one occurrence takes ("work out for 30 minutes") is not the length of the repetition, so never put it in forDuration.
</repeat_rules>`,
  category: `<category_rules>
- categoryId is the single id in <context> categories closest in meaning to the to-do. Use null when nothing fits or the list is empty.
</category_rules>`,
  planRepeat: `<repeat_rules>
- Without repetition, pattern is NONE.
- every day → DAILY. every weekday → WEEKDAYS. Use WEEKENDS only for a stated habit: "every weekend", "weekends", "on weekends". "this weekend", "on the weekend", and "over the weekend" mean the coming weekend once → THIS_WEEKEND.
- "every Mon, Wed and Fri" → WEEKLY_DAYS with daysOfWeek ["MON","WED","FRI"]. For a bare "every week" with a weekday in date, put that one weekday in daysOfWeek.
- "every other Tuesday", "every two weeks on Tuesday" → BIWEEKLY_DAYS with daysOfWeek ["TUE"].
- "on the 15th of every month", "monthly on the 15th" → MONTHLY_DAY with monthDay 15. "the last day of every month" is monthDay 31.
- Work spread across a whole week without "every", such as "workout this week" or "meetings next week" → THIS_WEEK, NEXT_WEEK, WEEK_AFTER_NEXT. "this weekend", "next weekend" → THIS_WEEKEND, NEXT_WEEKEND. "during the week" → THIS_WEEKDAYS.
- One-off events that span days (business trip, vacation, exam, conference) are not repetition: pattern NONE, with the span in date and endDate. "away on a business trip all next week" → date next Monday, endDate next Sunday.
- Yearly, "the nth weekday of the month", intervals of three weeks or more, and hourly repetition → UNSUPPORTED. Keep the stated weekday or date in date.
- Weekdays and days of a repetition go only in daysOfWeek and monthDay. Use date only when a start is stated separately, otherwise NONE.
- Use until ("until the end of December" → CALENDAR_DATE month 12, day 31) or forDuration ("for a month" → MONTH 1) only when the end of the repetition is stated. Without a stated end, both are null (it keeps repeating). Never invent an end date. How long one occurrence takes ("work out for 30 minutes") is not the length of the repetition, so never put it in forDuration.
- A repeating to-do lasts one day. endDate is null when it repeats.
</repeat_rules>`,
  planCategory: `<category_rules>
- categoryId is the single id in <context> categories closest in meaning to the to-do. Use null when nothing fits or the list is empty.
</category_rules>`,
} as const;
