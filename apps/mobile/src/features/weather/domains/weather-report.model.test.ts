import type { WeatherAlert as WeatherAlertDto, WeatherNextHourPeriod } from '@aido/api';

import { createHourlySeries, createWeatherReport } from '../__tests__/weather-report.factories';
import { WeatherReportPolicy } from './weather-report.model';

const NOW = new Date('2026-11-02T06:26:00.000Z');

function createPeriod(overrides: Partial<WeatherNextHourPeriod> = {}): WeatherNextHourPeriod {
  return {
    condition: 'PRECIPITATION',
    precipitationType: 'RAIN',
    startsAt: '2026-11-02T06:43:00.000Z',
    endsAt: null,
    precipitationChance: 80,
    precipitationIntensity: 2.4,
    ...overrides,
  };
}

const NEXT_HOUR_MINUTES = [
  { startsAt: '2026-11-02T06:26:00.000Z', precipitationChance: 10, precipitationIntensity: 0 },
  { startsAt: '2026-11-02T07:25:00.000Z', precipitationChance: 80, precipitationIntensity: 2 },
];

function createAlert(overrides: Partial<WeatherAlertDto>): WeatherAlertDto {
  return {
    id: 'alert',
    title: '호우주의보',
    severity: 'MODERATE',
    source: '기상청',
    areaName: '서울',
    effectiveAt: '2026-11-02T05:00:00.000Z',
    expiresAt: '2026-11-02T12:00:00.000Z',
    detailsUrl: 'https://example.com/alert',
    ...overrides,
  };
}

describe('WeatherReportPolicy.precipitationWindow', () => {
  it('분 단위 예보에서 비가 시작되면 시작 시각과 시간별 예보로 찾은 그침 시각을 함께 반환한다', () => {
    // Given
    const report = createWeatherReport({
      nextHour: { periods: [createPeriod()], minutes: NEXT_HOUR_MINUTES },
      hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [80, 80, 20, 10]),
    });

    // When
    const window = WeatherReportPolicy.precipitationWindow(report, NOW);

    // Then
    expect(window).toEqual({
      kind: 'upcoming',
      precision: 'minute',
      precipitationType: 'RAIN',
      startsAt: new Date('2026-11-02T06:43:00.000Z'),
      endsAt: new Date('2026-11-02T08:00:00.000Z'),
      endsOnLaterDay: false,
    });
    expect(WeatherReportPolicy.minutesUntil(new Date('2026-11-02T06:43:00.000Z'), NOW)).toBe(17);
  });

  it('비 구간이 이미 시작됐으면 지금 오는 비로 보고 구간 끝 시각을 그침 시각으로 쓴다', () => {
    // Given
    const report = createWeatherReport({
      nextHour: {
        periods: [
          createPeriod({
            startsAt: '2026-11-02T06:20:00.000Z',
            endsAt: '2026-11-02T06:50:00.000Z',
          }),
        ],
        minutes: NEXT_HOUR_MINUTES,
      },
    });

    // When
    const window = WeatherReportPolicy.precipitationWindow(report, NOW);

    // Then
    expect(window).toEqual({
      kind: 'ongoing',
      precipitationType: 'RAIN',
      endsAt: new Date('2026-11-02T06:50:00.000Z'),
      endsOnLaterDay: false,
    });
  });

  it('비가 예보 범위 끝까지 이어지면 그침 시각 없이 시작 시각만 반환한다', () => {
    // Given
    const report = createWeatherReport({
      nextHour: { periods: [createPeriod()], minutes: NEXT_HOUR_MINUTES },
      hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [80, 80, 80, 80]),
    });

    // When
    const window = WeatherReportPolicy.precipitationWindow(report, NOW);

    // Then
    expect(window).toMatchObject({ kind: 'upcoming', endsAt: null, endsOnLaterDay: false });
  });

  it('이미 끝난 비 구간은 건너뛰고 분 단위 예보 이후의 시간별 예보를 본다', () => {
    // Given
    const report = createWeatherReport({
      nextHour: {
        periods: [
          createPeriod({
            startsAt: '2026-11-02T06:00:00.000Z',
            endsAt: '2026-11-02T06:20:00.000Z',
          }),
        ],
        minutes: NEXT_HOUR_MINUTES,
      },
      hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [80, 10, 10, 10]),
    });

    // When
    const window = WeatherReportPolicy.precipitationWindow(report, NOW);

    // Then
    expect(window).toEqual({ kind: 'dry' });
  });

  it('분 단위 예보가 없는 지역은 시간별 예보로 비가 시작·그치는 시간을 정한다', () => {
    // Given
    const report = createWeatherReport({
      nextHour: null,
      hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [10, 80, 80, 10]),
    });

    // When
    const window = WeatherReportPolicy.precipitationWindow(report, NOW);

    // Then
    expect(window).toEqual({
      kind: 'upcoming',
      precision: 'hour',
      precipitationType: 'RAIN',
      startsAt: new Date('2026-11-02T07:00:00.000Z'),
      endsAt: new Date('2026-11-02T09:00:00.000Z'),
      endsOnLaterDay: false,
    });
  });

  it('분 단위 예보가 없고 지금 시간대에 비가 오면 지금 오는 비로 본다', () => {
    // Given
    const report = createWeatherReport({
      nextHour: null,
      hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [80, 10]),
    });

    // When
    const window = WeatherReportPolicy.precipitationWindow(report, NOW);

    // Then
    expect(window).toMatchObject({
      kind: 'ongoing',
      endsAt: new Date('2026-11-02T07:00:00.000Z'),
    });
  });

  it('비 예보가 없으면 맑은 상태를 반환한다', () => {
    // Given
    const report = createWeatherReport({
      nextHour: null,
      hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [10, 20, 30, 40]),
    });

    // When
    const window = WeatherReportPolicy.precipitationWindow(report, NOW);

    // Then
    expect(window).toEqual({ kind: 'dry' });
  });

  it.each([
    ['Asia/Seoul', true],
    ['Asia/Tokyo', true],
    ['Europe/London', false],
  ])('비가 위치 시간대의 자정을 넘겨 그치는지 판단한다 (%s → %s)', (timezone, expected) => {
    // Given
    const now = new Date('2026-11-02T14:26:00.000Z');
    const report = createWeatherReport({
      location: { latitude: 0, longitude: 0, timezone },
      nextHour: null,
      hourly: createHourlySeries('2026-11-02T14:00:00.000Z', [80, 10]),
    });

    // When
    const window = WeatherReportPolicy.precipitationWindow(report, now);

    // Then
    expect(window).toMatchObject({
      kind: 'ongoing',
      endsAt: new Date('2026-11-02T15:00:00.000Z'),
      endsOnLaterDay: expected,
    });
  });
});

describe('WeatherReportPolicy.upcomingHours', () => {
  it('지금이 속한 시간부터 남기고 이미 지난 시간은 뺀다', () => {
    // Given
    const report = createWeatherReport({
      hourly: createHourlySeries('2026-11-02T05:00:00.000Z', [10, 10, 10]),
    });

    // When
    const hours = WeatherReportPolicy.upcomingHours(report.hourly, NOW);

    // Then
    expect(hours.map((hour) => hour.startsAt.toISOString())).toEqual([
      '2026-11-02T06:00:00.000Z',
      '2026-11-02T07:00:00.000Z',
    ]);
  });
});

describe('WeatherReportPolicy.displayTemperature', () => {
  it.each([
    [12.4, 'celsius', 12],
    [12.5, 'celsius', 13],
    [-0.4, 'celsius', 0],
    [12.4, 'fahrenheit', 54],
    [37, 'fahrenheit', 99],
    [-17.9, 'fahrenheit', 0],
  ] as const)('섭씨 %s도를 %s 단위로 반올림해 %s로 보여 준다', (celsius, unit, expected) => {
    // When
    const value = WeatherReportPolicy.displayTemperature(celsius, unit);

    // Then
    expect(Object.is(value, expected)).toBe(true);
  });
});

describe('WeatherReportPolicy.isStale', () => {
  it('공급자에서 받은 지 30분까지는 최신으로 본다', () => {
    // Given
    const report = createWeatherReport({ fetchedAt: '2026-11-02T06:20:00.000Z' });

    // When
    const stale = WeatherReportPolicy.isStale(report, new Date('2026-11-02T06:50:00.000Z'));

    // Then
    expect(stale).toBe(false);
  });

  it('공급자에서 받은 지 30분이 지나면 오래된 정보로 본다', () => {
    // Given
    const report = createWeatherReport({ fetchedAt: '2026-11-02T06:20:00.000Z' });

    // When
    const stale = WeatherReportPolicy.isStale(report, new Date('2026-11-02T06:50:01.000Z'));

    // Then
    expect(stale).toBe(true);
  });
});

describe('WeatherReportPolicy.activeAlerts', () => {
  it('만료된 특보를 빼고 심각도가 높은 순, 같으면 먼저 발효된 순으로 정렬한다', () => {
    // Given
    const report = createWeatherReport({
      alerts: [
        createAlert({ id: 'minor', severity: 'MINOR' }),
        createAlert({ id: 'expired', severity: 'EXTREME', expiresAt: '2026-11-02T06:00:00.000Z' }),
        createAlert({
          id: 'severe-late',
          severity: 'SEVERE',
          effectiveAt: '2026-11-02T06:00:00.000Z',
        }),
        createAlert({
          id: 'severe-early',
          severity: 'SEVERE',
          effectiveAt: '2026-11-02T04:00:00.000Z',
        }),
      ],
    });

    // When
    const alerts = WeatherReportPolicy.activeAlerts(report.alerts, NOW);

    // Then
    expect(alerts.map((alert) => alert.id)).toEqual(['severe-early', 'severe-late', 'minor']);
  });
});

describe('WeatherReportPolicy.airQualityGrade', () => {
  it.each([
    [{ pm10: 30, pm25: 15 }, 'good'],
    [{ pm10: 31, pm25: 15 }, 'moderate'],
    [{ pm10: 20, pm25: 36 }, 'bad'],
    [{ pm10: 151, pm25: null }, 'veryBad'],
    [{ pm10: null, pm25: 76 }, 'veryBad'],
    [{ pm10: null, pm25: null }, null],
  ])('%o는 둘 중 더 나쁜 등급 %s로 보여 준다', (airQuality, expected) => {
    // When
    const grade = WeatherReportPolicy.airQualityGrade(airQuality);

    // Then
    expect(grade).toBe(expected);
  });
});

describe('WeatherReportPolicy.uvLevel', () => {
  it.each([
    [2, 'low'],
    [3, 'moderate'],
    [7, 'high'],
    [10, 'veryHigh'],
    [11, 'extreme'],
  ] as const)('자외선 지수 %s는 %s 단계다', (uvIndex, expected) => {
    // When
    const level = WeatherReportPolicy.uvLevel(uvIndex);

    // Then
    expect(level).toBe(expected);
  });
});
