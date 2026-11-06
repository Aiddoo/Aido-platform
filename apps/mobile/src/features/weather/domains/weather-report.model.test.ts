import type { WeatherAlert as WeatherAlertDto, WeatherNextHourPeriod } from '@aido/api';

import {
  createAttributionDto,
  createHanoiReportDto,
  createHourlySeries,
  createSeoulReportDto,
  createTokyoReportDto,
  createWeatherReport,
} from '../__tests__/weather-report.factories';
import { toWeatherReport } from '../apis/weather.mapper';
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
      endPrecision: 'hour',
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
      endPrecision: 'minute',
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
      endPrecision: 'hour',
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

describe('WeatherReportPolicy.degrees', () => {
  it.each([
    [12, '12°'],
    [0, '0°'],
    [-3, '−3°'],
  ])('%s도를 마이너스 기호를 써서 %s로 보여 준다', (value, expected) => {
    // When
    const text = WeatherReportPolicy.degrees(value);

    // Then
    expect(text).toBe(expected);
  });
});

describe('WeatherReportPolicy.temperatureReading', () => {
  it.each([
    [-4, { isBelowZero: true, magnitude: 4 }],
    [0, { isBelowZero: false, magnitude: 0 }],
    [23, { isBelowZero: false, magnitude: 23 }],
  ])('큰 기온 %s도는 영하 기호와 숫자를 나눠 %o로 읽는다', (value, expected) => {
    // When
    const reading = WeatherReportPolicy.temperatureReading(value);

    // Then
    expect(reading).toEqual(expected);
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
  it('만료된 특보만 빼고 서버가 정한 심각도 순서는 바꾸지 않는다', () => {
    // Given
    const report = createWeatherReport({
      alerts: [
        createAlert({ id: 'expired', severity: 'EXTREME', expiresAt: '2026-11-02T06:00:00.000Z' }),
        createAlert({ id: 'severe', severity: 'SEVERE' }),
        createAlert({ id: 'minor', severity: 'MINOR' }),
      ],
    });

    // When
    const alerts = WeatherReportPolicy.activeAlerts(report.alerts, NOW);

    // Then
    expect(alerts.map((alert) => alert.id)).toEqual(['severe', 'minor']);
  });

  it('발효 전인 특보는 남기되 아직 발효되지 않은 것으로 구분한다', () => {
    // Given
    const report = createWeatherReport({
      alerts: [createAlert({ id: 'upcoming', effectiveAt: '2026-11-02T09:00:00.000Z' })],
    });

    // When
    const [alert] = WeatherReportPolicy.activeAlerts(report.alerts, NOW);

    // Then
    expect(alert?.id).toBe('upcoming');
    expect(alert != null && WeatherReportPolicy.isAlertInEffect(alert, NOW)).toBe(false);
  });
});

describe('WeatherReportPolicy.sunEvents', () => {
  it('일출·일몰이 모두 있으면 두 시각을 그대로 보여 준다', () => {
    // Given
    const [day] = createWeatherReport().daily;

    // When
    const events = day == null ? null : WeatherReportPolicy.sunEvents(day, true);

    // Then
    expect(events).toEqual({
      kind: 'regular',
      sunrise: new Date('2026-11-01T21:51:00.000Z'),
      sunset: new Date('2026-11-02T08:28:00.000Z'),
    });
  });

  it.each([
    [true, 'polarDay'],
    [false, 'polarNight'],
  ] as const)('일출·일몰이 모두 없고 낮 여부가 %s이면 %s로 보여 준다', (isDaylight, kind) => {
    // Given
    const [day] = createWeatherReport().daily;

    // When
    const events =
      day == null
        ? null
        : WeatherReportPolicy.sunEvents({ ...day, sunrise: null, sunset: null }, isDaylight);

    // Then
    expect(events).toEqual({ kind });
  });

  it('일몰만 없는 날은 일출 시각만 남긴다', () => {
    // Given
    const [day] = createWeatherReport().daily;

    // When
    const events =
      day == null ? null : WeatherReportPolicy.sunEvents({ ...day, sunset: null }, true);

    // Then
    expect(events).toMatchObject({ kind: 'regular', sunset: null });
  });
});

describe('WeatherReportPolicy.compassDirection', () => {
  it.each([
    [0, 'n'],
    [22, 'n'],
    [23, 'ne'],
    [315, 'nw'],
    [359, 'n'],
    [null, null],
  ] as const)('풍향 %s도는 %s 방위로 보여 준다', (degrees, expected) => {
    // When
    const direction = WeatherReportPolicy.compassDirection(degrees);

    // Then
    expect(direction).toBe(expected);
  });
});

describe('WeatherReportPolicy.feelsLike', () => {
  it.each([
    [12, 9.9, 'colder'],
    [12, 10.1, 'similar'],
    [12, 14, 'warmer'],
  ] as const)(
    '기온 %s°, 체감 %s°이면 %s로 안내한다',
    (temperature, apparentTemperature, expected) => {
      // Given
      const { current } = createWeatherReport();

      // When
      const comparison = WeatherReportPolicy.feelsLike({
        ...current,
        temperature,
        apparentTemperature,
      });

      // Then
      expect(comparison).toBe(expected);
    },
  );
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

describe('지역별 리포트 프리셋', () => {
  it('국내처럼 분 단위 예보·특보가 없으면 시간별 예보로 정시 기준 강수를 안내하고 특보는 비운다', () => {
    // Given
    const report = toWeatherReport(createSeoulReportDto());

    // When
    const window = WeatherReportPolicy.precipitationWindow(report, NOW);
    const alerts = WeatherReportPolicy.activeAlerts(report.alerts, NOW);

    // Then
    expect(window).toEqual({
      kind: 'upcoming',
      precision: 'hour',
      precipitationType: 'RAIN',
      startsAt: new Date('2026-11-02T07:00:00.000Z'),
      endsAt: new Date('2026-11-02T09:00:00.000Z'),
      endPrecision: 'hour',
      endsOnLaterDay: false,
    });
    expect(alerts).toEqual([]);
  });

  it('도쿄처럼 분 단위 예보가 있으면 분 단위로 시작을 안내하고 도쿄 시간대 기준으로 날짜를 판단한다', () => {
    // Given
    const report = toWeatherReport(createTokyoReportDto());

    // When
    const window = WeatherReportPolicy.precipitationWindow(report, NOW);

    // Then
    expect(window).toMatchObject({ kind: 'upcoming', precision: 'minute', endsOnLaterDay: false });
    expect(WeatherReportPolicy.activeAlerts(report.alerts, NOW)).toHaveLength(1);
  });

  it('하노이처럼 대기질이 없으면 대기질 등급을 계산하지 않는다', () => {
    // Given
    const report = toWeatherReport(createHanoiReportDto());

    // Then
    expect(report.airQuality).toBeNull();
    expect(report.nextHour).toBeNull();
  });
});

describe('WeatherReportPolicy.isNowcastExpired', () => {
  it.each([
    ['2026-11-02T12:20:00.000Z', false],
    ['2026-11-02T12:20:01.000Z', true],
  ])('%s에는 6시간 경계를 기준으로 곧 올 비 안내를 숨길지 정한다 (%s)', (now, expected) => {
    // Given
    const report = createWeatherReport({ fetchedAt: '2026-11-02T06:20:00.000Z' });

    // When
    const expired = WeatherReportPolicy.isNowcastExpired(report, new Date(now));

    // Then
    expect(expired).toBe(expected);
  });
});

describe('WeatherReportPolicy.attributionMark', () => {
  it.each([
    ['dark', 1, '_wht_ko_1X_'],
    ['dark', 2, '_wht_ko_2X_'],
    ['dark', 3, '_wht_ko_3X_'],
    ['light', 2.625, '_blk_ko_3X_'],
    ['light', 4, '_blk_ko_3X_'],
  ] as const)(
    '%s 바탕·화면 밀도 %s에는 %s 로고 하나를 고른다',
    (background, pixelRatio, marker) => {
      // Given 로고가 있는 리포트 When 바탕과 화면 밀도로 고르면 Then 그 밀도 이상의 해상도 하나를 고른다
      const { attribution } = createWeatherReport();

      const mark = WeatherReportPolicy.attributionMark(attribution, background, pixelRatio);

      expect(mark.kind === 'logo' && mark.uri.includes(marker)).toBe(true);
    },
  );

  it('로고를 받지 못하면 서비스 이름을 글자로 표기한다', () => {
    // Given 로고가 없는 리포트 When 표기를 고르면 Then 서비스 이름 글자를 쓴다
    const { attribution } = createWeatherReport({
      attribution: createAttributionDto({ logo: null }),
    });

    const mark = WeatherReportPolicy.attributionMark(attribution, 'dark', 3);

    expect(mark).toEqual({ kind: 'text', serviceName: 'Apple Weather' });
  });
});

describe('WeatherReportPolicy.isDifferentWallClock', () => {
  const now = new Date('2026-10-01T06:00:00Z');

  it.each([
    ['Asia/Seoul', false],
    ['Asia/Tokyo', false],
    ['Asia/Bangkok', true],
    ['America/Los_Angeles', true],
  ])('기기 시간대가 %s이면 서울 리포트의 벽시계가 다른지는 %s다', (deviceTimeZone, expected) => {
    // Given 서울 리포트 When 기기 시간대와 지금 벽시계를 비교하면 Then 오프셋이 다를 때만 다르다
    const report = createWeatherReport();

    expect(WeatherReportPolicy.isDifferentWallClock(report, deviceTimeZone, now)).toBe(expected);
  });
});

describe('WeatherReportPolicy.precipitationCondition', () => {
  it.each([
    ['SNOW', 'SNOW'],
    ['SLEET', 'SNOW'],
    ['HAIL', 'SNOW'],
    ['RAIN', 'RAIN'],
    ['MIXED', 'RAIN'],
    ['NONE', 'RAIN'],
  ] as const)('%s는 %s 아이콘으로 그린다', (type, expected) => {
    // Given / When / Then 얼어 내리면 눈, 그 밖에는 비다
    expect(WeatherReportPolicy.precipitationCondition(type)).toBe(expected);
    expect(WeatherReportPolicy.isFrozenPrecipitation(type)).toBe(expected === 'SNOW');
  });
});

describe('WeatherReportPolicy.todayKey', () => {
  it('오늘 날짜는 기기가 아니라 예보 위치 시간대로 정한다', () => {
    // Given 서울 자정 직후(UTC로는 전날)
    const report = createWeatherReport();
    const justAfterSeoulMidnight = new Date('2026-09-30T15:05:00Z');

    // When / Then
    expect(WeatherReportPolicy.todayKey(report, justAfterSeoulMidnight)).toBe('2026-10-01');
  });
});

describe('오프라인에서 저장한 리포트를 실제 지금 기준으로 볼 때', () => {
  const restored = createWeatherReport({
    fetchedAt: '2026-11-02T06:00:00.000Z',
    hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [10, 10, 10, 10, 10, 10, 10, 10]),
  });
  const now = new Date('2026-11-02T13:10:00.000Z');

  it('7시간 전에 받은 리포트는 오래된 정보이고 곧 올 비 안내도 만료된다', () => {
    // Given 06:00에 받은 리포트 When 13:10에 다시 열면 Then 오래됨·nowcast 만료다
    expect(WeatherReportPolicy.isStale(restored, now)).toBe(true);
    expect(WeatherReportPolicy.isNowcastExpired(restored, now)).toBe(true);
  });

  it('받은 시각이 아니라 지금 이후 시간만 남겨 지난 시간 칸을 보이지 않는다', () => {
    // Given 06:00~13:00 시간별 예보 When 13:10 기준으로 고르면 Then 13시 칸만 남는다
    const hours = WeatherReportPolicy.upcomingHours(restored.hourly, now);

    expect(hours.map((hour) => hour.startsAt.toISOString())).toEqual(['2026-11-02T13:00:00.000Z']);
  });
});
