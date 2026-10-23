import { userPreferenceSchema } from '@aido/api';
import type { z } from 'zod';

export const preferenceSchema = userPreferenceSchema.omit({ timezone: true });
export type Preference = z.infer<typeof preferenceSchema>;

export function isWeatherEnabled(preference: Preference) {
  return preference.weatherMorningEnabled || preference.weatherEveningEnabled;
}

export function isPushDisabled(preference: Preference) {
  return !preference.pushEnabled;
}

export function isWeatherDisabled(preference: Preference) {
  return isPushDisabled(preference) || !isWeatherEnabled(preference);
}

export const PreferencePolicy = {
  isWeatherEnabled,
  isPushDisabled,
  isWeatherDisabled,
} as const;
