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

describe('미세먼지 등급 정책', () => {
  test.each([
    [30, 'good'],
    [31, 'normal'],
    [80, 'normal'],
    [81, 'bad'],
    [150, 'bad'],
    [151, 'veryBad'],
  ] as const)('PM10 %i㎍/㎥은 %s 등급이다', (pm10, expected) => {
    // Given
    const conditions = { pm10 };
    // When
    const grade = WeatherPolicy.pm10Grade(conditions);
    // Then
    expect(grade).toBe(expected);
  });

  test.each([
    [15, 'good'],
    [16, 'normal'],
    [35, 'normal'],
    [36, 'bad'],
    [75, 'bad'],
    [76, 'veryBad'],
  ] as const)('PM2.5 %i㎍/㎥은 %s 등급이다', (pm25, expected) => {
    // Given
    const conditions = { pm25 };
    // When
    const grade = WeatherPolicy.pm25Grade(conditions);
    // Then
    expect(grade).toBe(expected);
  });

  test('측정값이 없으면 등급을 만들지 않는다', () => {
    // Given
    const conditions = { pm10: null, pm25: null };
    // When
    const grades = [WeatherPolicy.pm10Grade(conditions), WeatherPolicy.pm25Grade(conditions)];
    // Then
    expect(grades).toEqual([null, null]);
  });
});

describe('기온 색 단계 정책', () => {
  test.each([
    [35, 'scorching'],
    [34.9, 'hot'],
    [25, 'warm'],
    [20, 'mild'],
    [15, 'fresh'],
    [10, 'cool'],
    [5, 'chilly'],
    [4.9, 'cold'],
  ] as const)('%s°는 %s 단계다', (temperature, expected) => {
    // Given
    const input = temperature;
    // When
    const tone = WeatherPolicy.temperatureTone(input);
    // Then
    expect(tone).toBe(expected);
  });
});
