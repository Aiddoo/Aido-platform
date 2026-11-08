import { TIME_FORMATS } from '@aido/api/vocabulary';
import { z } from 'zod';

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

function isWeatherEnabled(
  preference: Pick<Preference, 'weatherMorningEnabled' | 'weatherEveningEnabled'>,
) {
  return preference.weatherMorningEnabled || preference.weatherEveningEnabled;
}

function canDeliverWeather(
  preference: Pick<Preference, 'pushEnabled' | 'weatherMorningEnabled' | 'weatherEveningEnabled'>,
) {
  return preference.pushEnabled && isWeatherEnabled(preference);
}

export const PreferencePolicy = {
  isWeatherEnabled,
  canDeliverWeather,
} as const;
