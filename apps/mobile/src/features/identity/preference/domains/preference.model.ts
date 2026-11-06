import type { Preference } from '../schemas/preference.schema';

function isWeatherEnabled(
  preference: Pick<Preference, 'weatherMorningEnabled' | 'weatherEveningEnabled'>,
) {
  return preference.weatherMorningEnabled || preference.weatherEveningEnabled;
}

function isPushDisabled(preference: Pick<Preference, 'pushEnabled'>) {
  return !preference.pushEnabled;
}

function isWeatherDisabled(
  preference: Pick<Preference, 'pushEnabled' | 'weatherMorningEnabled' | 'weatherEveningEnabled'>,
) {
  return isPushDisabled(preference) || !isWeatherEnabled(preference);
}

export const PreferencePolicy = {
  isWeatherEnabled,
  isPushDisabled,
  isWeatherDisabled,
} as const;
