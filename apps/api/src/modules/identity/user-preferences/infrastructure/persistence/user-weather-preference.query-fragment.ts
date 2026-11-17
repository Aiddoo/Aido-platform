import { QueryBuilder } from "drizzle-orm/pg-core";

import { userPreference } from "#api/platform/database/schema/index";

// 다른 Context가 사람 id 칸 옆에 날씨 알림 설정(켜짐·아침·저녁 시각)과 시간대·언어를 한 SQL로 붙이는 하위 질의다
export function userWeatherPreference() {
  return new QueryBuilder()
    .select({
      userId: userPreference.userId,
      timezone: userPreference.timezone,
      locale: userPreference.locale,
      weatherMorningEnabled: userPreference.weatherMorningEnabled,
      weatherMorningHour: userPreference.weatherMorningHour,
      weatherMorningMinute: userPreference.weatherMorningMinute,
      weatherEveningEnabled: userPreference.weatherEveningEnabled,
      weatherEveningHour: userPreference.weatherEveningHour,
      weatherEveningMinute: userPreference.weatherEveningMinute,
    })
    .from(userPreference)
    .as("weather_preference");
}
