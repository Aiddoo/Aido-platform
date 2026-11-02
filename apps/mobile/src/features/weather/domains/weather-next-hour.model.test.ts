import { createHourlySeries, createWeatherReport } from '../__tests__/weather-report.factories';
import { WeatherNextHourPolicy } from './weather-next-hour.model';

describe('WeatherNextHourPolicy.hourlyOutlook', () => {
  const NOW = new Date('2026-11-02T06:26:00.000Z');

  it('6시간 안에 비 오는 시간이 있으면 그 첫 시간과 확률을 돌려준다', () => {
    // Given 15시 10%, 16시 70%, 17시 60% When 고르면 Then 16시가 나온다
    const { hourly } = createWeatherReport({
      hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [10, 70, 60]),
    });

    const outlook = WeatherNextHourPolicy.hourlyOutlook(hourly, NOW);

    expect(outlook?.hour.startsAt).toEqual(new Date('2026-11-02T07:00:00.000Z'));
    expect(outlook?.hour.precipitationChance).toBe(70);
    expect(outlook?.isOngoing).toBe(false);
  });

  it('지금 시간이 비 오는 시간이면 지금 오고 있다고 본다', () => {
    // Given 15시 80% When 15:26에 고르면 Then 진행 중이다
    const { hourly } = createWeatherReport({
      hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [80, 10]),
    });

    expect(WeatherNextHourPolicy.hourlyOutlook(hourly, NOW)?.isOngoing).toBe(true);
  });

  it('6시간 안에 비 소식이 없으면 빈 카드를 만들지 않도록 null이다', () => {
    // Given 6시간 맑고 7시간 뒤 비 When 고르면 Then null이다
    const { hourly } = createWeatherReport({
      hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [10, 10, 10, 10, 10, 10, 10, 90]),
    });

    expect(WeatherNextHourPolicy.hourlyOutlook(hourly, NOW)).toBeNull();
  });
});
