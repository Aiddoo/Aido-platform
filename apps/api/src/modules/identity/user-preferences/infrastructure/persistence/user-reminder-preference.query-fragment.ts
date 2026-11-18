import { QueryBuilder } from "drizzle-orm/pg-core";

import { userPreference } from "#api/platform/database/schema/index";

// 다른 Context가 사람 id 칸 옆에 리마인더 설정(시간대·언어·연속 기록·아침·저녁 시각)을 한 SQL로 붙이는 하위 질의다.
// PG가 펼쳐 바로 조인하므로 실행 계획은 테이블 조인과 같다
export function userReminderPreference() {
  return new QueryBuilder()
    .select({
      userId: userPreference.userId,
      timezone: userPreference.timezone,
      locale: userPreference.locale,
      currentStreak: userPreference.currentStreak,
      lastCompletedDate: userPreference.lastCompletedDate,
      morningReminderHour: userPreference.morningReminderHour,
      morningReminderMinute: userPreference.morningReminderMinute,
      eveningReminderHour: userPreference.eveningReminderHour,
      eveningReminderMinute: userPreference.eveningReminderMinute,
    })
    .from(userPreference)
    .as("reminder_preference");
}
