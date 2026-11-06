import type { WeatherHourlyForecast } from '@aido/api';
import { range } from 'es-toolkit';

import {
  createHourlyForecastDto,
  createWeatherReport,
} from '../__tests__/weather-report.factories';
import { WeatherHourlyPolicy } from './weather-hourly.model';

const HOUR_MS = 60 * 60_000;
/** 서울 오후 3시 26분 */
const NOW = new Date('2026-11-02T06:26:00.000Z');
const START = '2026-11-02T06:00:00.000Z';

function createHours(rows: readonly Partial<WeatherHourlyForecast>[]) {
  return rows.map((row, index) =>
    createHourlyForecastDto({
      startsAt: new Date(Date.parse(START) + index * HOUR_MS).toISOString(),
      ...row,
    }),
  );
}

const DRY_CLOUDY = { condition: 'CLOUDY', precipitationChance: 10 } as const;
const RAIN = { condition: 'RAIN', precipitationChance: 80, precipitationType: 'RAIN' } as const;

describe('WeatherHourlyPolicy.summarizeHourly', () => {
  it('지금 비가 오면 처음 그치는 시간을 그침 시각으로 반환한다', () => {
    // Given 지금부터 2시간 비, 그 뒤 갬 When 요약하면 Then 오후 5시에 그친다
    const report = createWeatherReport({ hourly: createHours([RAIN, RAIN, DRY_CLOUDY]) });

    expect(WeatherHourlyPolicy.summarizeHourly(report, NOW)).toEqual({
      kind: 'precipitationOngoing',
      precipitationType: 'RAIN',
      endsAt: new Date('2026-11-02T08:00:00.000Z'),
      endsOnLaterDay: false,
    });
  });

  it('시간별 확률이 낮아도 지금 관측된 비가 있으면 내리는 중으로 반환한다', () => {
    // Given 지금 4.5mm/h 비가 오고 시간별 확률은 47% When 요약하면 Then 비가 내리는 중이다
    const base = createWeatherReport({
      hourly: createHours([{ ...DRY_CLOUDY, precipitationChance: 47 }, DRY_CLOUDY]),
    });
    const report = {
      ...base,
      current: { ...base.current, condition: 'RAIN', precipitationIntensity: 4.5 },
    } as const;

    expect(WeatherHourlyPolicy.summarizeHourly(report, NOW)).toMatchObject({
      kind: 'precipitationOngoing',
      precipitationType: 'RAIN',
      endsAt: new Date('2026-11-02T07:00:00.000Z'),
    });
  });

  it('비가 하루 안에 그치지 않으면 그침 시각 없이 반환한다', () => {
    // Given 남은 시간 내내 비 When 요약하면 Then endsAt은 null이다
    const report = createWeatherReport({ hourly: createHours([RAIN, RAIN]) });

    expect(WeatherHourlyPolicy.summarizeHourly(report, NOW)).toMatchObject({
      kind: 'precipitationOngoing',
      endsAt: null,
    });
  });

  it('내일 비가 오면 그 전 하늘과 함께 다음 날이라고 표시한다', () => {
    // Given 오늘 밤까지 흐리고 다음 날 새벽 비 When 요약하면 Then 내일 비와 흐린 하늘을 반환한다
    const report = createWeatherReport({
      hourly: createHours([...range(10).map(() => DRY_CLOUDY), RAIN]),
    });

    expect(WeatherHourlyPolicy.summarizeHourly(report, NOW)).toEqual({
      kind: 'precipitationUpcoming',
      precipitationType: 'RAIN',
      startsAt: new Date('2026-11-02T16:00:00.000Z'),
      startsOnLaterDay: true,
      skyBefore: 'cloudy',
    });
  });

  it('강수 확률이 낮은 비 상태는 비로 보지 않는다', () => {
    // Given 상태는 비지만 확률 30% When 요약하면 Then 강수 요약이 아니다
    const report = createWeatherReport({
      hourly: createHours([DRY_CLOUDY, { condition: 'RAIN', precipitationChance: 30 }]),
    });

    expect(WeatherHourlyPolicy.summarizeHourly(report, NOW)).not.toMatchObject({
      kind: 'precipitationUpcoming',
    });
  });

  it('두 시간 이상 이어지는 다른 하늘이 오면 바뀌는 시각을 반환한다', () => {
    // Given 맑다가 한 시간 구름, 다시 맑다가 흐림이 이어짐 When 요약하면 Then 흐려지는 시각을 반환한다
    const clear = { condition: 'CLEAR', precipitationChance: 0 } as const;
    const report = createWeatherReport({
      hourly: createHours([clear, DRY_CLOUDY, clear, DRY_CLOUDY, DRY_CLOUDY]),
    });

    expect(WeatherHourlyPolicy.summarizeHourly(report, NOW)).toEqual({
      kind: 'skyChange',
      from: 'clear',
      to: 'cloudy',
      changesAt: new Date('2026-11-02T09:00:00.000Z'),
      changesOnLaterDay: false,
    });
  });

  it('하늘이 그대로인 낮에는 남은 낮의 최고 기온을 정점으로 반환한다', () => {
    // Given 낮 동안 12→16→13° When 요약하면 Then 오후 4시 16°가 정점이다
    const report = createWeatherReport({
      hourly: createHours([
        { ...DRY_CLOUDY, temperature: 12 },
        { ...DRY_CLOUDY, temperature: 16 },
        { ...DRY_CLOUDY, temperature: 13 },
        { ...DRY_CLOUDY, temperature: 20, isDaylight: false },
      ]),
    });

    expect(WeatherHourlyPolicy.summarizeHourly(report, NOW)).toEqual({
      kind: 'steady',
      sky: 'cloudy',
      peak: { extreme: 'highest', at: new Date('2026-11-02T07:00:00.000Z'), temperature: 16 },
    });
  });

  it('밤에는 최저 기온을 정점으로 보고, 지금과 1° 미만 차이면 정점을 두지 않는다', () => {
    // Given 밤 동안 8.0→7.4° When 요약하면 Then 정점이 없다
    const report = createWeatherReport({
      hourly: createHours([
        { ...DRY_CLOUDY, temperature: 8, isDaylight: false },
        { ...DRY_CLOUDY, temperature: 7.4, isDaylight: false },
      ]),
    });

    expect(WeatherHourlyPolicy.summarizeHourly(report, NOW)).toEqual({
      kind: 'steady',
      sky: 'cloudy',
      peak: null,
    });
  });

  it('남은 시간별 예보가 없으면 null을 반환한다', () => {
    // Given 모두 지난 예보 When 요약하면 Then null이다
    const report = createWeatherReport({ hourly: createHours([DRY_CLOUDY]) });

    expect(
      WeatherHourlyPolicy.summarizeHourly(report, new Date('2026-11-02T08:00:00.000Z')),
    ).toBeNull();
  });
});
