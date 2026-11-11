import { getNowInstant } from '@src/shared/date/clock';
import { fromEpochMs, toInstant } from '@src/shared/date/instant';

import {
  createDailyForecast,
  createHourlyForecastDto,
  createWeatherReport,
} from '../__tests__/weather-report.fixtures';
import { WeatherDetailPolicy } from './weather-detail.model';

const SUNRISE = toInstant('2026-11-01T21:51:00.000Z');
const SUNSET = toInstant('2026-11-02T08:28:00.000Z');
const DAY = createDailyForecast({ sunrise: SUNRISE, sunset: SUNSET });

describe('findSunscreenWindow', () => {
  const now = toInstant('2026-11-02T02:30:00.000Z');
  const hourly = createWeatherReport({
    hourly: [1, 4, 5, 3, 2, 6].map((uvIndex, index) =>
      createHourlyForecastDto({
        startsAt: fromEpochMs(Date.parse('2026-11-02T02:00:00.000Z') + index * 3_600_000),
        uvIndex,
      }),
    ),
  }).hourly;

  it('오늘 남은 시간 중 자외선 3 이상인 첫 시각부터 마지막 시각 끝까지다', () => {
    // When
    const window = WeatherDetailPolicy.findSunscreenWindow(hourly, now, 'Asia/Seoul');

    // Then
    // 12~15시와 16시에 자외선 3 이상이라 12시~17시(서울)다
    expect(window).toEqual({
      startsAt: toInstant('2026-11-02T03:00:00.000Z'),
      endsAt: toInstant('2026-11-02T08:00:00.000Z'),
    });
  });

  it('자외선이 약하면 null이다', () => {
    // Given
    const weakHourly = hourly.map((hour) => ({ ...hour, uvIndex: 1 }));

    // When
    const window = WeatherDetailPolicy.findSunscreenWindow(weakHourly, now, 'Asia/Seoul');

    // Then
    expect(window).toBeNull();
  });
});

describe('calculateNextDayPrecipitation', () => {
  it('지나간 시간은 빼고 남은 시간의 강수량을 더한다', () => {
    // Given
    // 06시 0.4mm, 07시 1.25mm, 08시 2mm
    const hourly = createWeatherReport({
      hourly: [0.4, 1.25, 2].map((amount, index) =>
        createHourlyForecastDto({
          startsAt: fromEpochMs(Date.parse('2026-11-02T06:00:00.000Z') + index * 3_600_000),
          precipitationAmount: amount,
        }),
      ),
    }).hourly;
    const now = toInstant('2026-11-02T07:10:00.000Z');

    // When
    const total = WeatherDetailPolicy.calculateNextDayPrecipitation(hourly, now);

    // Then
    // 07시 1.25mm와 08시 2mm를 더한 3.25mm를 소수 첫째 자리로 맞춘다
    expect(total).toBe(3.3);
  });

  it('시간별 예보가 없으면 null이다', () => {
    // When
    const total = WeatherDetailPolicy.calculateNextDayPrecipitation([], getNowInstant());

    // Then
    expect(total).toBeNull();
  });
});

describe('findNextSunEvent', () => {
  const tomorrow = { sunrise: toInstant('2026-11-02T21:52:00.000Z') };

  it.each([
    { now: '2026-11-01T20:00:00.000Z', kind: 'sunrise' },
    { now: '2026-11-02T06:00:00.000Z', kind: 'sunset' },
    { now: '2026-11-02T10:00:00.000Z', kind: 'sunriseTomorrow' },
  ] as const)('$now에는 아직 오지 않은 가장 가까운 해 일정이 $kind다', ({ now, kind }) => {
    // When
    const event = WeatherDetailPolicy.findNextSunEvent(DAY, tomorrow, toInstant(now));

    // Then
    expect(event?.kind).toBe(kind);
  });

  it('일몰 뒤 내일 예보가 없으면 null이다', () => {
    // Given
    const afterSunset = toInstant('2026-11-02T10:00:00.000Z');

    // When
    const event = WeatherDetailPolicy.findNextSunEvent(DAY, null, afterSunset);

    // Then
    expect(event).toBeNull();
  });
});

describe('findDaylightDuration', () => {
  it('일출부터 일몰까지를 시간·분으로 나눈다', () => {
    // When
    const duration = WeatherDetailPolicy.findDaylightDuration(DAY);

    // Then
    // 06:51~17:28(서울)이라 10시간 37분이다
    expect(duration).toEqual({ hours: 10, minutes: 37 });
  });
});

describe('findDayAfter', () => {
  const [today] = createWeatherReport().daily;
  const daily =
    today == null
      ? []
      : [today, { ...today, date: '2026-11-03' }, { ...today, date: '2026-11-04' }];

  it('오늘 다음 날짜의 예보를 찾는다', () => {
    // When
    const day = WeatherDetailPolicy.findDayAfter(daily, '2026-11-02');

    // Then
    expect(day?.date).toBe('2026-11-03');
  });

  it('오늘 다음 날짜 중 가장 이른 예보를 찾는다', () => {
    // When
    const day = WeatherDetailPolicy.findDayAfter(daily, '2026-11-03');

    // Then
    expect(day?.date).toBe('2026-11-04');
  });

  it('예보 범위의 마지막 날이면 null이다', () => {
    // When
    const day = WeatherDetailPolicy.findDayAfter(daily, '2026-11-04');

    // Then
    expect(day).toBeNull();
  });
});

describe('findNextFullMoon', () => {
  const daily = createWeatherReport().daily;
  const [today] = daily;

  it('오늘 뒤 처음 오는 보름달 날짜를 찾는다', () => {
    // Given
    // 오늘 하현, 사흘 뒤와 닷새 뒤 보름
    const forecast =
      today == null
        ? []
        : [
            today,
            { ...today, date: '2026-11-05', moonPhase: 'FULL' as const },
            { ...today, date: '2026-11-07', moonPhase: 'FULL' as const },
          ];

    // When
    const fullMoonDate = WeatherDetailPolicy.findNextFullMoon(forecast, '2026-11-02');

    // Then
    expect(fullMoonDate).toBe('2026-11-05');
  });

  it('예보 범위에 보름달이 없으면 null이다', () => {
    // When
    const fullMoonDate = WeatherDetailPolicy.findNextFullMoon(daily, '2026-11-02');

    // Then
    expect(fullMoonDate).toBeNull();
  });
});
