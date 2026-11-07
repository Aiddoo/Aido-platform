import { WEATHER_QUERY_KEYS } from '../constants/weather-query-keys';

describe('WEATHER_QUERY_KEYS.report', () => {
  it('위치가 실제로 바뀐 리비전마다 다른 리포트 캐시를 쓰고, 모두 날씨 무효화 범위 안에 둔다', () => {
    // Given
    const revisions = [0, 1];

    // When
    const [saved, moved] = revisions.map((locationRevision) =>
      WEATHER_QUERY_KEYS.report({ locationRevision }),
    );

    // Then
    expect(saved).toEqual(['weather', 'report', { locationRevision: 0 }]);
    expect(saved).not.toEqual(moved);
    expect(saved?.slice(0, 2)).toEqual(WEATHER_QUERY_KEYS.reports());
  });
});

describe('WeatherReportSelect', () => {});
