import { TIME_FORMATS } from '@aido/api/vocabulary';
import { z } from 'zod';

/** 기기 시간대는 기기가 정하므로 시간대 칸은 두지 않는다 */
export const preferenceSchema = z.object({
  pushEnabled: z.boolean(),
  nightPushEnabled: z.boolean(),
  morningReminderHour: z.int(),
  morningReminderMinute: z.int(),
  eveningReminderHour: z.int(),
  eveningReminderMinute: z.int(),
  timeFormat: z.enum(TIME_FORMATS),
  weatherMorningEnabled: z.boolean(),
  weatherMorningHour: z.int(),
  weatherMorningMinute: z.int(),
  weatherEveningEnabled: z.boolean(),
  weatherEveningHour: z.int(),
  weatherEveningMinute: z.int(),
});
export type Preference = z.infer<typeof preferenceSchema>;

/** 오전이나 저녁 중 하나라도 켜져 있으면 날씨 알림을 쓰는 것으로 본다 */
function isWeatherEnabled(preference: Preference) {
  return preference.weatherMorningEnabled || preference.weatherEveningEnabled;
}

/** 푸시가 꺼져 있으면 날씨 알림도 나가지 않는다 */
function canDeliverWeather(preference: Preference) {
  return preference.pushEnabled && isWeatherEnabled(preference);
}

export const PreferencePolicy = {
  isWeatherEnabled,
  canDeliverWeather,
} as const;
