import type { WeatherAlert as WeatherAlertDto, WeatherNextHourPeriod } from '@aido/api';
import { toInstant } from '@src/shared/date/instant';

import {
  createHourlySeries,
  createSeoulReportDto,
  createTokyoReportDto,
  createWeatherReport,
  createWeatherReportDto,
  createWeatherReportWithHours,
} from '../__tests__/weather-report.fixtures';
import { toWeatherReport } from '../apis/weather.mapper';
import {
  findTodayOrFirstForecast,
  getPrecipitationWindow,
  getTodayKey,
  isNowcastExpired,
  isReportStale,
  WeatherReportPolicy,
} from './weather-report.model';

const NOW = toInstant('2026-11-02T06:26:00.000Z');

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

describe('getPrecipitationWindow', () => {
  it('분 단위 예보에서 비가 시작되면 시작 시각과 시간별 예보로 찾은 그침 시각을 함께 반환한다', () => {
    // Given
    const report = createWeatherReport({
      nextHour: { periods: [createPeriod()], minutes: NEXT_HOUR_MINUTES },
      hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [80, 80, 20, 10]),
    });

    // When
    const window = getPrecipitationWindow(report, NOW);

    // Then
    expect(window).toEqual({
      kind: 'upcoming',
      precision: 'minute',
      precipitationType: 'RAIN',
      startsAt: toInstant('2026-11-02T06:43:00.000Z'),
      endsAt: toInstant('2026-11-02T08:00:00.000Z'),
      endPrecision: 'hour',
      isEndingOnLaterDay: false,
    });
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
    const window = getPrecipitationWindow(report, NOW);

    // Then
    expect(window).toEqual({
      kind: 'ongoing',
      precipitationType: 'RAIN',
      endsAt: toInstant('2026-11-02T06:50:00.000Z'),
      endPrecision: 'minute',
      isEndingOnLaterDay: false,
    });
  });

  it('비가 예보 범위 끝까지 이어지면 그침 시각 없이 시작 시각만 반환한다', () => {
    // Given
    const report = createWeatherReport({
      nextHour: { periods: [createPeriod()], minutes: NEXT_HOUR_MINUTES },
      hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [80, 80, 80, 80]),
    });

    // When
    const window = getPrecipitationWindow(report, NOW);

    // Then
    expect(window).toMatchObject({ kind: 'upcoming', endsAt: null, isEndingOnLaterDay: false });
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
    const window = getPrecipitationWindow(report, NOW);

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
    const window = getPrecipitationWindow(report, NOW);

    // Then
    expect(window).toEqual({
      kind: 'upcoming',
      precision: 'hour',
      precipitationType: 'RAIN',
      startsAt: toInstant('2026-11-02T07:00:00.000Z'),
      endsAt: toInstant('2026-11-02T09:00:00.000Z'),
      endPrecision: 'hour',
      isEndingOnLaterDay: false,
    });
  });

  it('분 단위 예보가 없고 지금 시간대에 비가 오면 지금 오는 비로 본다', () => {
    // Given
    const report = createWeatherReport({
      nextHour: null,
      hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [80, 10]),
    });

    // When
    const window = getPrecipitationWindow(report, NOW);

    // Then
    expect(window).toMatchObject({
      kind: 'ongoing',
      endsAt: toInstant('2026-11-02T07:00:00.000Z'),
    });
  });

  it('비 예보가 없으면 맑은 상태를 반환한다', () => {
    // Given
    const report = createWeatherReport({
      nextHour: null,
      hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [10, 20, 30, 40]),
    });

    // When
    const window = getPrecipitationWindow(report, NOW);

    // Then
    expect(window).toEqual({ kind: 'dry' });
  });

  it.each([
    { timezone: 'Asia/Seoul', expected: true },
    { timezone: 'Asia/Tokyo', expected: true },
    { timezone: 'Europe/London', expected: false },
  ])(
    '위치 시간대가 $timezone이면 비가 자정을 넘겨 그치는지는 $expected다',
    ({ timezone, expected }) => {
      // Given
      const now = toInstant('2026-11-02T14:26:00.000Z');
      const report = createWeatherReport({
        location: { latitude: 0, longitude: 0, timezone },
        nextHour: null,
        hourly: createHourlySeries('2026-11-02T14:00:00.000Z', [80, 10]),
      });

      // When
      const window = getPrecipitationWindow(report, now);

      // Then
      expect(window).toMatchObject({
        kind: 'ongoing',
        endsAt: toInstant('2026-11-02T15:00:00.000Z'),
        isEndingOnLaterDay: expected,
      });
    },
  );

  it('국내처럼 분 단위 예보가 없으면 시간별 예보로 정시 기준 강수를 안내한다', () => {
    // Given
    const report = toWeatherReport(createSeoulReportDto());

    // When
    const window = getPrecipitationWindow(report, NOW);

    // Then
    expect(window).toEqual({
      kind: 'upcoming',
      precision: 'hour',
      precipitationType: 'RAIN',
      startsAt: toInstant('2026-11-02T07:00:00.000Z'),
      endsAt: toInstant('2026-11-02T09:00:00.000Z'),
      endPrecision: 'hour',
      isEndingOnLaterDay: false,
    });
  });

  it('도쿄처럼 분 단위 예보가 있으면 분 단위로 시작을 안내하고 도쿄 시간대 기준으로 날짜를 판단한다', () => {
    // Given
    const report = toWeatherReport(createTokyoReportDto());

    // When
    const window = getPrecipitationWindow(report, NOW);

    // Then
    expect(window).toMatchObject({
      kind: 'upcoming',
      precision: 'minute',
      isEndingOnLaterDay: false,
    });
  });
});

describe('getUpcomingHours', () => {
  it('지금이 속한 시간부터 남기고 이미 지난 시간은 뺀다', () => {
    // Given
    const report = createWeatherReport({
      hourly: createHourlySeries('2026-11-02T05:00:00.000Z', [10, 10, 10]),
    });

    // When
    const hours = WeatherReportPolicy.getUpcomingHours(report.hourly, NOW);

    // Then
    expect(hours.map((hour) => hour.startsAt)).toEqual([
      '2026-11-02T06:00:00.000Z',
      '2026-11-02T07:00:00.000Z',
    ]);
  });

  it('받은 시각이 아니라 지금 이후 시간만 남겨 지난 시간 칸을 보이지 않는다', () => {
    // Given
    // 06:00~13:00 시간별 예보를 13:10에 다시 연다
    const restored = createWeatherReport({
      hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [10, 10, 10, 10, 10, 10, 10, 10]),
    });
    const reopenedAt = toInstant('2026-11-02T13:10:00.000Z');

    // When
    const hours = WeatherReportPolicy.getUpcomingHours(restored.hourly, reopenedAt);

    // Then
    expect(hours.map((hour) => hour.startsAt)).toEqual(['2026-11-02T13:00:00.000Z']);
  });
});

describe('getTodayKey', () => {
  const seoul = { location: { latitude: 37.5, longitude: 127, timezone: 'Asia/Seoul' } };
  const losAngeles = {
    location: { latitude: 34, longitude: -118, timezone: 'America/Los_Angeles' },
  };

  it('같은 순간도 자정 직전과 정각에 지역 날짜가 바뀐다', () => {
    // Given
    // 서울 자정 1밀리초 전과 정각
    const before = toInstant('2026-11-02T14:59:59.999Z');
    const at = toInstant('2026-11-02T15:00:00.000Z');

    // When
    const keyBefore = getTodayKey(seoul, before);
    const keyAt = getTodayKey(seoul, at);

    // Then
    expect(keyBefore).toBe('2026-11-02');
    expect(keyAt).toBe('2026-11-03');
  });

  it('서머타임이 끝나는 날 LA 자정은 07:00Z에서 08:00Z로 밀리지 않고 날짜 key가 이어진다', () => {
    // Given
    // LA는 2026-11-01 02:00에 서머타임이 끝난다
    const beforeEnd = toInstant('2026-11-01T08:59:59.999Z');
    const afterEnd = toInstant('2026-11-01T09:00:00.000Z');
    const nextMidnight = toInstant('2026-11-02T08:00:00.000Z');

    // When
    const keyBeforeEnd = getTodayKey(losAngeles, beforeEnd);
    const keyAfterEnd = getTodayKey(losAngeles, afterEnd);
    const keyNextMidnight = getTodayKey(losAngeles, nextMidnight);

    // Then
    expect(keyBeforeEnd).toBe('2026-11-01');
    expect(keyAfterEnd).toBe('2026-11-01');
    expect(keyNextMidnight).toBe('2026-11-02');
  });

  it('오늘 날짜는 기기가 아니라 예보 위치 시간대로 정한다', () => {
    // Given
    // 서울 자정 직후(UTC로는 전날)
    const report = createWeatherReport();
    const justAfterSeoulMidnight = toInstant('2026-09-30T15:05:00Z');

    // When
    const key = getTodayKey(report, justAfterSeoulMidnight);

    // Then
    expect(key).toBe('2026-10-01');
  });
});

describe('isReportStale', () => {
  it('공급자에서 받은 지 30분까지는 최신으로 본다', () => {
    // Given
    const report = createWeatherReport({ fetchedAt: '2026-11-02T06:20:00.000Z' });

    // When
    const stale = isReportStale(report, toInstant('2026-11-02T06:50:00.000Z'));

    // Then
    expect(stale).toBe(false);
  });

  it('공급자에서 받은 지 30분이 지나면 오래된 정보로 본다', () => {
    // Given
    const report = createWeatherReport({ fetchedAt: '2026-11-02T06:20:00.000Z' });

    // When
    const stale = isReportStale(report, toInstant('2026-11-02T06:50:01.000Z'));

    // Then
    expect(stale).toBe(true);
  });
});

describe('getActiveAlerts', () => {
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
    const alerts = WeatherReportPolicy.getActiveAlerts(report.alerts, NOW);

    // Then
    expect(alerts.map((alert) => alert.id)).toEqual(['severe', 'minor']);
  });

  it('발효 전인 특보는 남기되 아직 발효되지 않은 것으로 구분한다', () => {
    // Given
    const report = createWeatherReport({
      alerts: [createAlert({ id: 'upcoming', effectiveAt: '2026-11-02T09:00:00.000Z' })],
    });

    // When
    const [alert] = WeatherReportPolicy.getActiveAlerts(report.alerts, NOW);

    // Then
    expect(alert?.id).toBe('upcoming');
    expect(alert != null && WeatherReportPolicy.isAlertInEffect(alert, NOW)).toBe(false);
  });

  it('국내처럼 특보가 없는 지역은 빈 목록이다', () => {
    // Given
    const report = toWeatherReport(createSeoulReportDto());

    // When
    const alerts = WeatherReportPolicy.getActiveAlerts(report.alerts, NOW);

    // Then
    expect(alerts).toEqual([]);
  });

  it('도쿄 리포트의 유효한 특보는 남긴다', () => {
    // Given
    const report = toWeatherReport(createTokyoReportDto());

    // When
    const alerts = WeatherReportPolicy.getActiveAlerts(report.alerts, NOW);

    // Then
    expect(alerts).toHaveLength(1);
  });
});

describe('getSunEvents', () => {
  it('일출·일몰이 모두 있으면 두 시각을 그대로 보여 준다', () => {
    // Given
    const [day] = createWeatherReport().daily;

    // When
    const events = day == null ? null : WeatherReportPolicy.getSunEvents(day, { isDaylight: true });

    // Then
    expect(events).toEqual({
      kind: 'regular',
      sunrise: toInstant('2026-11-01T21:51:00.000Z'),
      sunset: toInstant('2026-11-02T08:28:00.000Z'),
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
        : WeatherReportPolicy.getSunEvents({ ...day, sunrise: null, sunset: null }, { isDaylight });

    // Then
    expect(events).toEqual({ kind });
  });

  it('일몰만 없는 날은 일출 시각만 남긴다', () => {
    // Given
    const [day] = createWeatherReport().daily;

    // When
    const events =
      day == null
        ? null
        : WeatherReportPolicy.getSunEvents({ ...day, sunset: null }, { isDaylight: true });

    // Then
    expect(events).toMatchObject({ kind: 'regular', sunset: null });
  });
});

describe('findHourlyPrecipitationOutlook', () => {
  it('6시간 안에 비 오는 시간이 있으면 그 첫 시간과 확률을 돌려준다', () => {
    // Given
    const { hourly } = createWeatherReport({
      hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [10, 70, 60]),
    });

    // When
    const outlook = WeatherReportPolicy.findHourlyPrecipitationOutlook(hourly, NOW);

    // Then
    expect(outlook?.hour.startsAt).toBe('2026-11-02T07:00:00.000Z');
    expect(outlook?.hour.precipitationChance).toBe(70);
    expect(outlook?.isOngoing).toBe(false);
  });

  it('지금 시간이 비 오는 시간이면 지금 오고 있다고 본다', () => {
    // Given
    const { hourly } = createWeatherReport({
      hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [80, 10]),
    });

    // When
    const outlook = WeatherReportPolicy.findHourlyPrecipitationOutlook(hourly, NOW);

    // Then
    expect(outlook?.isOngoing).toBe(true);
  });

  it('6시간 안에 비 소식이 없으면 빈 카드를 만들지 않도록 null이다', () => {
    // Given
    const { hourly } = createWeatherReport({
      hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [10, 10, 10, 10, 10, 10, 10, 90]),
    });

    // When
    const outlook = WeatherReportPolicy.findHourlyPrecipitationOutlook(hourly, NOW);

    // Then
    expect(outlook).toBeNull();
  });
});

describe('isNowcastExpired', () => {
  it.each([
    { now: '2026-11-02T12:20:00.000Z', expected: false },
    { now: '2026-11-02T12:20:01.000Z', expected: true },
  ])(
    '받은 지 6시간 경계에서 $now에는 곧 올 비 안내를 숨기는지가 $expected다',
    ({ now, expected }) => {
      // Given
      const report = createWeatherReport({ fetchedAt: '2026-11-02T06:20:00.000Z' });

      // When
      const expired = isNowcastExpired(report, toInstant(now));

      // Then
      expect(expired).toBe(expected);
    },
  );

  it('7시간 전에 받은 리포트를 다시 열면 곧 올 비 안내도 만료된다', () => {
    // Given
    const restored = createWeatherReport({ fetchedAt: '2026-11-02T06:00:00.000Z' });
    const reopenedAt = toInstant('2026-11-02T13:10:00.000Z');

    // When
    const expired = isNowcastExpired(restored, reopenedAt);

    // Then
    expect(expired).toBe(true);
  });
});

describe('isFrozenPrecipitation', () => {
  it.each([
    ['SNOW', true],
    ['SLEET', true],
    ['HAIL', true],
    ['RAIN', false],
    ['MIXED', false],
    ['NONE', false],
  ] as const)('%s가 얼어 내리는지는 %s다', (type, expected) => {
    // When
    const isFrozen = WeatherReportPolicy.isFrozenPrecipitation(type);

    // Then
    expect(isFrozen).toBe(expected);
  });
});

function createHour(row: Parameters<typeof createWeatherReportWithHours>[0][number]) {
  const [hour] = createWeatherReportWithHours([row]).hourly;
  if (hour == null) {
    throw new Error('예보 한 시간을 만들지 못했다');
  }
  return hour;
}

describe('isWetHour', () => {
  it.each([
    { precipitationChance: 49, expected: false },
    { precipitationChance: 50, expected: true },
    { precipitationChance: 51, expected: true },
    { precipitationChance: 0, expected: false },
  ])(
    '강수 확률 $precipitationChance%면 비 오는 시간인지는 $expected다',
    ({ precipitationChance, expected }) => {
      // Given
      const hour = createHour({ precipitationChance });

      // When
      const result = WeatherReportPolicy.isWetHour(hour);

      // Then
      // 50% 이상이면 비 오는 시간이다(서버 날씨 알림과 같은 기준)
      expect(result).toBe(expected);
    },
  );
});

describe('findTodayOrFirstForecast', () => {
  const createDays = (...dates: string[]) =>
    dates.flatMap((date) => createWeatherReportDto().daily.map((day) => ({ ...day, date })));
  const report = createWeatherReport({ daily: createDays('2026-11-01', '2026-11-02') });

  it('위치 시간대의 오늘 예보를 고른다', () => {
    // When
    // 06:26Z는 서울 11월 2일 15:26이다
    const today = findTodayOrFirstForecast(report, NOW);

    // Then
    expect(today?.date).toBe('2026-11-02');
  });

  it('서울 자정 직전에는 그날, 자정에는 다음 날 예보를 고른다', () => {
    // Given
    const beforeMidnight = toInstant('2026-11-01T14:59:59.000Z');
    const atMidnight = toInstant('2026-11-01T15:00:00.000Z');

    // When
    const before = findTodayOrFirstForecast(report, beforeMidnight);
    const after = findTodayOrFirstForecast(report, atMidnight);

    // Then
    expect([before?.date, after?.date]).toEqual(['2026-11-01', '2026-11-02']);
  });

  it('일별 예보에 오늘이 없으면 첫 예보를 오늘처럼 쓴다', () => {
    // Given
    const lagging = createWeatherReport({ daily: createDays('2026-11-03', '2026-11-04') });

    // When
    const today = findTodayOrFirstForecast(lagging, NOW);

    // Then
    expect(today?.date).toBe('2026-11-03');
  });

  it('일별 예보가 없으면 null이다', () => {
    // Given
    const empty = createWeatherReport({ daily: [] });

    // When
    const today = findTodayOrFirstForecast(empty, NOW);

    // Then
    expect(today).toBeNull();
  });
});
