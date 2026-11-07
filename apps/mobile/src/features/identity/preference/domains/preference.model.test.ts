import { createPreference } from '../__tests__/preference.fixtures';
import { PreferencePolicy } from './preference.model';

describe('isWeatherEnabled', () => {
  it('오전 알림만 켜져 있어도 날씨 알림을 쓰는 것으로 본다', () => {
    // Given
    const preference = createPreference({ weatherMorningEnabled: true });

    // When
    const result = PreferencePolicy.isWeatherEnabled(preference);

    // Then
    expect(result).toBe(true);
  });

  it('오전과 저녁이 모두 꺼져 있으면 날씨 알림을 쓰지 않는 것으로 본다', () => {
    // Given
    const preference = createPreference();

    // When
    const result = PreferencePolicy.isWeatherEnabled(preference);

    // Then
    expect(result).toBe(false);
  });
});

describe('isWeatherDeliveryOff', () => {
  it('푸시가 꺼져 있으면 날씨 알림을 켜 둬도 나가지 않는다', () => {
    // Given
    const preference = createPreference({ pushEnabled: false, weatherEveningEnabled: true });

    // When
    const result = PreferencePolicy.isWeatherDeliveryOff(preference);

    // Then
    expect(result).toBe(true);
  });

  it('푸시가 켜져 있고 저녁 알림이 켜져 있으면 날씨 알림이 나간다', () => {
    // Given
    const preference = createPreference({ pushEnabled: true, weatherEveningEnabled: true });

    // When
    const result = PreferencePolicy.isWeatherDeliveryOff(preference);

    // Then
    expect(result).toBe(false);
  });

  it('푸시가 켜져 있어도 날씨 알림이 모두 꺼져 있으면 나가지 않는다', () => {
    // Given
    const preference = createPreference({ pushEnabled: true });

    // When
    const result = PreferencePolicy.isWeatherDeliveryOff(preference);

    // Then
    expect(result).toBe(true);
  });
});
