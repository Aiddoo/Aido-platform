import { DAY_MS, MINUTE_MS } from '@src/shared/constants/time-units';
import { toInstant } from '@src/shared/date/instant';
import { createTestQueryClient } from '@src/testing/core';
import { QueryObserver } from '@tanstack/react-query';

import {
  createHourlyForecasts,
  createHourlySeries,
  createWeatherReport,
} from '../__tests__/weather-report.fixtures';
import { WEATHER_QUERY_KEYS } from './weather-query-keys';
import {
  getReportRefetchIntervalMs,
  getReportStaleTimeMs,
  WeatherReportSelect,
} from './weather.queries';

describe('WeatherReportSelect.hourly', () => {
  it('분이 바뀌어도 같은 시간 안이면 시간별 칸 목록의 참조가 그대로라 칸이 다시 그려지지 않는다', () => {
    // Given
    const client = createTestQueryClient();
    const queryKey = WEATHER_QUERY_KEYS.report({ locationRevision: 0 });
    client.setQueryData(
      queryKey,
      createWeatherReport({
        hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [10, 10, 10, 10]),
      }),
    );
    const selectAt = (now: string) => WeatherReportSelect.hourly(toInstant(now));
    const observer = new QueryObserver(client, {
      queryKey,
      select: selectAt('2026-11-02T06:05:00.000Z'),
    });
    const first = observer.getCurrentResult().data;

    // When
    observer.setOptions({ queryKey, select: selectAt('2026-11-02T06:06:00.000Z') });
    const sameHour = observer.getCurrentResult().data;
    observer.setOptions({ queryKey, select: selectAt('2026-11-02T07:00:00.000Z') });
    const nextHour = observer.getCurrentResult().data;

    // Then
    expect(sameHour?.timeline).toBe(first?.timeline);
    expect(nextHour?.timeline).not.toBe(first?.timeline);
    expect(nextHour?.timeline).toHaveLength((first?.timeline.length ?? 0) - 1);
  });
});

/** 서울 오후 3시 26분 */
const NOW = toInstant('2026-11-02T06:26:00.000Z');

const DRY_CLOUDY = { condition: 'CLOUDY', precipitationChance: 10 } as const;

describe('WeatherReportSelect.hourly 칸 목록', () => {
  it('범위 안의 일몰을 시각 순서로 끼워 넣고 지난 일출은 뺀다', () => {
    // Given
    const report = createWeatherReport({
      hourly: createHourlyForecasts([DRY_CLOUDY, DRY_CLOUDY, DRY_CLOUDY, DRY_CLOUDY]),
    });

    // When
    const kinds = WeatherReportSelect.hourly(NOW)(report).timeline.map((item) =>
      item.kind === 'hour' ? `hour:${item.isNow}` : item.kind,
    );

    // Then
    expect(kinds).toEqual(['hour:true', 'hour:false', 'hour:false', 'sunset', 'hour:false']);
  });

  it('일몰이 정각과 같은 시각이면 시간 칸이 일몰보다 먼저 온다', () => {
    // Given
    const base = createWeatherReport({
      hourly: createHourlyForecasts([DRY_CLOUDY, DRY_CLOUDY, DRY_CLOUDY, DRY_CLOUDY]),
    });
    const report = {
      ...base,
      daily: base.daily.map((day) => ({ ...day, sunset: toInstant('2026-11-02T08:00:00.000Z') })),
    };

    // When
    const kinds = WeatherReportSelect.hourly(NOW)(report).timeline.map((item) =>
      item.kind === 'hour' ? `hour:${item.isNow}` : item.kind,
    );

    // Then
    expect(kinds).toEqual(['hour:true', 'hour:false', 'hour:false', 'sunset', 'hour:false']);
  });

  it('남은 시간이 없으면 빈 목록을 반환한다', () => {
    // When
    const report = createWeatherReport({ hourly: [] });

    // Then
    expect(WeatherReportSelect.hourly(NOW)(report).timeline).toEqual([]);
  });
});

describe('getReportStaleTimeMs', () => {
  const RECEIVED_AT = toInstant('2026-11-02T06:20:00.000Z');

  it('받은 때부터 만료까지를 같은 리포트로 본다', () => {
    // Given
    const report = createWeatherReport({ expiresAt: '2026-11-02T06:50:00.000Z' });

    // When
    const staleTimeMs = getReportStaleTimeMs(report, RECEIVED_AT);

    // Then
    expect(staleTimeMs).toBe(30 * MINUTE_MS);
  });

  it('만료가 이미 지났거나 임박해도 1분보다 짧게 다시 묻지 않는다', () => {
    // Given
    const expired = createWeatherReport({ expiresAt: '2026-11-02T06:10:00.000Z' });
    const imminent = createWeatherReport({ expiresAt: '2026-11-02T06:20:10.000Z' });

    // When
    const expiredMs = getReportStaleTimeMs(expired, RECEIVED_AT);
    const imminentMs = getReportStaleTimeMs(imminent, RECEIVED_AT);

    // Then
    expect(expiredMs).toBe(MINUTE_MS);
    expect(imminentMs).toBe(MINUTE_MS);
  });

  it('만료가 없는 리포트(공급자 장애로 받은 마지막 리포트)는 5분 뒤 다시 묻는다', () => {
    // Given
    const report = createWeatherReport({ expiresAt: undefined });

    // When
    const staleTimeMs = getReportStaleTimeMs(report, RECEIVED_AT);

    // Then
    expect(staleTimeMs).toBe(5 * MINUTE_MS);
  });

  it('만료가 하루보다 멀면 하루로 줄인다', () => {
    // Given
    const report = createWeatherReport({ expiresAt: '2026-12-31T00:00:00.000Z' });

    // When
    const staleTimeMs = getReportStaleTimeMs(report, RECEIVED_AT);

    // Then
    expect(staleTimeMs).toBe(DAY_MS);
  });

  it('받은 리포트가 없으면 바로 오래된 것으로 본다', () => {
    // When
    const staleTimeMs = getReportStaleTimeMs(undefined, RECEIVED_AT);

    // Then
    expect(staleTimeMs).toBe(0);
  });

  it('남은 시간은 받은 때를 기준으로 세므로 지금과 다른 시각을 넘기면 다른 값이 나온다', () => {
    // Given
    const report = createWeatherReport({ expiresAt: '2026-11-02T06:50:00.000Z' });

    // When
    const fromReceived = getReportStaleTimeMs(report, toInstant('2026-11-02T06:20:00.000Z'));
    const fromLater = getReportStaleTimeMs(report, toInstant('2026-11-02T06:40:00.000Z'));

    // Then
    expect(fromReceived).toBe(30 * MINUTE_MS);
    expect(fromLater).toBe(10 * MINUTE_MS);
  });
});

describe('getReportRefetchIntervalMs', () => {
  const NOW_AT = toInstant('2026-11-02T06:20:00.000Z');

  it('지금부터 만료까지 남은 시간 뒤에 다시 받는다', () => {
    // Given
    const report = createWeatherReport({ expiresAt: '2026-11-02T06:35:00.000Z' });

    // When
    const intervalMs = getReportRefetchIntervalMs(report, NOW_AT);

    // Then
    expect(intervalMs).toBe(15 * MINUTE_MS);
  });

  it('만료가 지났으면 1분마다, 만료가 없으면 5분마다 다시 받는다', () => {
    // Given
    const expired = createWeatherReport({ expiresAt: '2026-11-02T06:00:00.000Z' });
    const noExpiry = createWeatherReport({ expiresAt: undefined });

    // When
    const expiredMs = getReportRefetchIntervalMs(expired, NOW_AT);
    const noExpiryMs = getReportRefetchIntervalMs(noExpiry, NOW_AT);

    // Then
    expect(expiredMs).toBe(MINUTE_MS);
    expect(noExpiryMs).toBe(5 * MINUTE_MS);
  });

  it('만료가 아주 멀어도 타이머 상한(2^31-1ms)을 넘지 않게 하루로 줄인다', () => {
    // Given
    const report = createWeatherReport({ expiresAt: '2099-01-01T00:00:00.000Z' });

    // When
    const intervalMs = getReportRefetchIntervalMs(report, NOW_AT);

    // Then
    expect(intervalMs).toBe(DAY_MS);
  });

  it('받은 리포트가 없으면 주기로 다시 받지 않는다', () => {
    // When
    const intervalMs = getReportRefetchIntervalMs(undefined, NOW_AT);

    // Then
    expect(intervalMs).toBe(false);
  });
});
