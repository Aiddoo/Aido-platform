import type { Preference } from '../schemas/preference.schema';

/** 오전이나 저녁 중 하나라도 켜져 있으면 날씨 알림을 쓰는 것으로 본다 */
function isWeatherEnabled(
  preference: Pick<Preference, 'weatherMorningEnabled' | 'weatherEveningEnabled'>,
) {
  return preference.weatherMorningEnabled || preference.weatherEveningEnabled;
}

/** 푸시가 꺼져 있으면 날씨 알림도 나가지 않는다 */
function canDeliverWeather(
  preference: Pick<Preference, 'pushEnabled' | 'weatherMorningEnabled' | 'weatherEveningEnabled'>,
) {
  return preference.pushEnabled && isWeatherEnabled(preference);
}

export const PreferencePolicy = {
  isWeatherEnabled,
  canDeliverWeather,
} as const;
