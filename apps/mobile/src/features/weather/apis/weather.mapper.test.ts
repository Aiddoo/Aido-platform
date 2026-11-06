import { toInstant } from '@src/shared/date/instant';

import { createWeatherReportDto } from '../__tests__/weather-report.fixtures';
import { toWeatherReport } from './weather.mapper';

describe('toWeatherReport', () => {
  it('ISO 시각을 Instant로 한 번만 바꾸고 날짜 key는 문자열로 둔다', () => {
    // Given
    const dto = createWeatherReportDto();

    // When
    const report = toWeatherReport(dto);

    // Then
    expect(report.current.observedAt).toEqual('2026-11-02T06:26:00.000Z');
    expect(report.hourly[0]?.startsAt).toEqual('2026-11-02T06:00:00.000Z');
    expect(report.daily[0]?.sunrise).toEqual('2026-11-01T21:51:00.000Z');
    expect(report.daily[0]?.date).toBe('2026-11-02');
  });

  it('극야·백야의 일출·일몰, 분 단위 예보·대기질이 없는 지역은 null로 유지한다', () => {
    // Given
    const dto = createWeatherReportDto({ nextHour: null, airQuality: null });
    const [day] = dto.daily;
    if (day == null) {
      throw new Error('daily fixture is empty');
    }
    dto.daily = [{ ...day, sunrise: null, sunset: null }];

    // When
    const report = toWeatherReport(dto);

    // Then
    expect(report.nextHour).toBeNull();
    expect(report.airQuality).toBeNull();
    expect(report.daily[0]?.sunrise).toBeNull();
    expect(report.daily[0]?.sunset).toBeNull();
  });

  it('비가 예보 범위 끝까지 이어지는 구간은 끝 시각을 null로 둔다', () => {
    // Given
    const dto = createWeatherReportDto({
      nextHour: {
        periods: [
          {
            condition: 'PRECIPITATION',
            precipitationType: 'RAIN',
            startsAt: '2026-11-02T06:43:00.000Z',
            endsAt: null,
            precipitationChance: 80,
            precipitationIntensity: 2.4,
          },
        ],
        minutes: [],
      },
    });

    // When
    const report = toWeatherReport(dto);

    // Then
    expect(report.nextHour?.periods[0]).toMatchObject({
      startsAt: toInstant('2026-11-02T06:43:00.000Z'),
      endsAt: null,
    });
  });
});
