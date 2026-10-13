import { WeatherPolicy } from './weather.model';

describe('날씨 위치 지원 정책', () => {
  test.each([
    ['서울', 37.5665, 126.978, 'KR', true],
    ['제주', 33.4996, 126.5312, 'KR', true],
    ['도쿄', 35.6762, 139.6503, 'JP', false],
    ['규슈', 33.59, 130.4, 'JP', false],
    ['국가 미확인', 37.5665, 126.978, null, false],
    ['잘못된 좌표', Number.NaN, 126.978, 'KR', false],
  ])(
    '%s 위치의 국내 예보 지원 여부는 %s이다',
    (_name, latitude, longitude, countryCode, expected) => {
      // Given
      const location = { latitude, longitude, countryCode };
      // When
      const result = WeatherPolicy.isSupportedLocation(location);
      // Then
      expect(result).toBe(expected);
    },
  );

  test('작은 GPS 오차는 위치 재등록으로 처리하지 않는다', () => {
    // Given
    const previous = { latitude: 37.5665, longitude: 126.978 };
    const nearby = { latitude: 37.5666, longitude: 126.9781 };
    const relocated = { latitude: 37.59, longitude: 127.02 };
    // When
    const sameArea = WeatherPolicy.isRelocationNeeded(nearby, previous);
    const differentArea = WeatherPolicy.isRelocationNeeded(relocated, previous);
    // Then
    expect(sameArea).toBe(false);
    expect(differentArea).toBe(true);
  });
});
