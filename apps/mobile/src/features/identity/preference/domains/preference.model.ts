import { userPreferenceSchema } from '@aido/api';
import type { z } from 'zod';

const preferenceSchema = userPreferenceSchema.omit({ timezone: true });
export type Preference = z.infer<typeof preferenceSchema>;

function isWeatherEnabled(preference: Preference) {
  return preference.weatherMorningEnabled || preference.weatherEveningEnabled;
}

function isPushDisabled(preference: Preference) {
  return !preference.pushEnabled;
}

function isWeatherDisabled(preference: Preference) {
  return isPushDisabled(preference) || !isWeatherEnabled(preference);
}

export const PreferencePolicy = {
  isWeatherEnabled,
  isPushDisabled,
  isWeatherDisabled,
} as const;
