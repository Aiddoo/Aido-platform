import { createPreference } from '../__tests__/preference.fixtures';
import { PreferencePolicy } from './preference.model';

describe('PreferencePolicy', () => {
  it('날씨 알림은 오전이나 저녁 중 하나만 켜져도 쓰는 것으로 본다', () => {
    // Given
    const morningOnly = createPreference({ weatherMorningEnabled: true });
    const none = createPreference();

    // When / Then
    expect(PreferencePolicy.isWeatherEnabled(morningOnly)).toBe(true);
    expect(PreferencePolicy.isWeatherEnabled(none)).toBe(false);
  });

  it('푸시가 꺼져 있으면 날씨 알림을 켜 둬도 나가지 않는다', () => {
    // Given
    const pushOff = createPreference({ pushEnabled: false, weatherEveningEnabled: true });
    const pushOn = createPreference({ pushEnabled: true, weatherEveningEnabled: true });

    // When / Then
    expect(PreferencePolicy.isWeatherDisabled(pushOff)).toBe(true);
    expect(PreferencePolicy.isWeatherDisabled(pushOn)).toBe(false);
  });
});
