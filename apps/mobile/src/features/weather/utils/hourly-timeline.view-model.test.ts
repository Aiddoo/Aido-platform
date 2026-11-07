import { toInstant } from '@src/shared/date/instant';

import { createHourlyForecasts, createWeatherReport } from '../__tests__/weather-report.fixtures';
import { toHourlyTimeline } from './hourly-timeline.view-model';

/** 서울 오후 3시 26분 */
const NOW = toInstant('2026-11-02T06:26:00.000Z');

const DRY_CLOUDY = { condition: 'CLOUDY', precipitationChance: 10 } as const;

describe('toHourlyTimeline', () => {
  it('범위 안의 일몰을 시각 순서로 끼워 넣고 지난 일출은 뺀다', () => {
    // Given 오후 3~6시 예보와 오후 5시 28분 일몰 When 타임라인을 만들면 Then 5시 칸 뒤에 일몰이 온다
    const report = createWeatherReport({
      hourly: createHourlyForecasts([DRY_CLOUDY, DRY_CLOUDY, DRY_CLOUDY, DRY_CLOUDY]),
    });

    const kinds = toHourlyTimeline(report, NOW).map((item) =>
      item.kind === 'hour' ? `hour:${item.isNow}` : item.kind,
    );

    expect(kinds).toEqual(['hour:true', 'hour:false', 'hour:false', 'sunset', 'hour:false']);
  });

  it('일몰이 정각과 같은 시각이면 시간 칸이 일몰보다 먼저 온다', () => {
    // Given 오후 5시 정각 일몰
    const base = createWeatherReport({
      hourly: createHourlyForecasts([DRY_CLOUDY, DRY_CLOUDY, DRY_CLOUDY, DRY_CLOUDY]),
    });
    const report = {
      ...base,
      daily: base.daily.map((day) => ({ ...day, sunset: toInstant('2026-11-02T08:00:00.000Z') })),
    };

    // When
    const kinds = toHourlyTimeline(report, NOW).map((item) =>
      item.kind === 'hour' ? `hour:${item.isNow}` : item.kind,
    );

    // Then
    expect(kinds).toEqual(['hour:true', 'hour:false', 'hour:false', 'sunset', 'hour:false']);
  });

  it('남은 시간이 없으면 빈 목록을 반환한다', () => {
    // Given 시간별 예보 없음 When 타임라인을 만들면 Then 빈 목록이다
    const report = createWeatherReport({ hourly: [] });

    expect(toHourlyTimeline(report, NOW)).toEqual([]);
  });
});
