import {
  createHourlyForecastDto,
  createWeatherReport,
} from '../__tests__/weather-report.factories';
import { WeatherDetailPolicy } from './weather-detail.model';

const SUNRISE = new Date('2026-11-01T21:51:00.000Z');
const SUNSET = new Date('2026-11-02T08:28:00.000Z');
const DAY = { sunrise: SUNRISE, sunset: SUNSET };

describe('WeatherDetailPolicy 막대 위치', () => {
  it.each([
    [0, 0.03],
    [4, 4 / 11],
    [15, 0.97],
  ])('자외선 %d은 막대의 %f 위치다', (uvIndex, expected) => {
    // Given 자외선 지수 When 막대 위치를 구하면 Then 3%~97% 안에서 11 기준 비율이다
    expect(WeatherDetailPolicy.uvMeterPosition(uvIndex)).toBeCloseTo(expected);
  });

  it.each([
    ['pm10', 15, 0.125],
    ['pm10', 80, 0.5],
    ['pm25', 25, 0.375],
    ['pm25', 500, 0.97],
  ] as const)('%s %d은 막대의 %f 위치다', (pollutant, value, expected) => {
    // Given 오염물질 농도 When 막대 위치를 구하면 Then 등급 칸 안에서 비례한 위치다
    expect(WeatherDetailPolicy.airMeterPosition(value, pollutant)).toBeCloseTo(expected);
  });
});

describe('WeatherDetailPolicy 단계 분류', () => {
  it.each([
    [16000, 16, 'clear'],
    [6000, 6, 'moderate'],
    [1240, 1.2, 'poor'],
  ] as const)('가시거리 %dm는 %fkm, %s다', (meters, kilometers, level) => {
    // Given 가시거리(m) When 표시 값과 단계를 구하면 Then 10km 미만만 소수 한 자리다
    expect(WeatherDetailPolicy.visibilityKilometers(meters)).toBe(kilometers);
    expect(WeatherDetailPolicy.visibilityLevel(meters)).toBe(level);
  });

  it.each([
    [95, 'overcast'],
    [40, 'mostlyCloudy'],
    [10, 'mostlyClear'],
  ] as const)('운량 %d%%는 %s다', (cloudCover, level) => {
    // Given 운량 When 단계를 구하면 Then 80·40 경계로 나뉜다
    expect(WeatherDetailPolicy.cloudCoverLevel(cloudCover)).toBe(level);
  });
});

describe('WeatherDetailPolicy.sunscreenWindow', () => {
  const now = new Date('2026-11-02T02:30:00.000Z');
  const hourly = createWeatherReport({
    hourly: [1, 4, 5, 3, 2, 6].map((uvIndex, index) =>
      createHourlyForecastDto({
        startsAt: new Date(
          Date.parse('2026-11-02T02:00:00.000Z') + index * 3_600_000,
        ).toISOString(),
        uvIndex,
      }),
    ),
  }).hourly;

  it('오늘 남은 시간 중 자외선 3 이상인 첫 시각부터 마지막 시각 끝까지다', () => {
    // Given 12시~15시, 16시에 자외선 3 이상 When 차단 시간을 구하면 Then 12시~17시(서울)다
    const window = WeatherDetailPolicy.sunscreenWindow(hourly, now, 'Asia/Seoul');

    expect(window).toEqual({
      startsAt: new Date('2026-11-02T03:00:00.000Z'),
      endsAt: new Date('2026-11-02T08:00:00.000Z'),
    });
  });

  it('자외선이 약하면 null이다', () => {
    // Given 자외선이 모두 2 이하 When 차단 시간을 구하면 Then 없다
    const weak = hourly.map((hour) => ({ ...hour, uvIndex: 1 }));

    expect(WeatherDetailPolicy.sunscreenWindow(weak, now, 'Asia/Seoul')).toBeNull();
  });
});

describe('WeatherDetailPolicy.nextDayPrecipitation', () => {
  it('지나간 시간은 빼고 남은 시간의 강수량을 더한다', () => {
    // Given 06시 0.4mm·07시 1.25mm·08시 2mm, 지금 07:10 When 합하면 Then 3.3mm다
    const hourly = createWeatherReport({
      hourly: [0.4, 1.25, 2].map((amount, index) =>
        createHourlyForecastDto({
          startsAt: new Date(
            Date.parse('2026-11-02T06:00:00.000Z') + index * 3_600_000,
          ).toISOString(),
          precipitationAmount: amount,
        }),
      ),
    }).hourly;

    expect(
      WeatherDetailPolicy.nextDayPrecipitation(hourly, new Date('2026-11-02T07:10:00.000Z')),
    ).toBe(3.3);
  });

  it('시간별 예보가 없으면 null이다', () => {
    // Given 빈 시간별 예보 When 합하면 Then 값을 모른다
    expect(WeatherDetailPolicy.nextDayPrecipitation([], new Date())).toBeNull();
  });
});

describe('WeatherDetailPolicy.nextSunEvent', () => {
  const tomorrow = { sunrise: new Date('2026-11-02T21:52:00.000Z') };

  it.each([
    ['2026-11-01T20:00:00.000Z', 'sunrise'],
    ['2026-11-02T06:00:00.000Z', 'sunset'],
    ['2026-11-02T10:00:00.000Z', 'sunriseTomorrow'],
  ] as const)('%s에는 다음 해 일정이 %s다', (now, kind) => {
    // Given 하루 중 시각 When 다음 해 일정을 구하면 Then 아직 오지 않은 가장 가까운 일정이다
    expect(WeatherDetailPolicy.nextSunEvent(DAY, tomorrow, new Date(now))?.kind).toBe(kind);
  });

  it('일몰 뒤 내일 예보가 없으면 null이다', () => {
    // Given 마지막 예보일 밤 When 다음 해 일정을 구하면 Then 없다
    expect(
      WeatherDetailPolicy.nextSunEvent(DAY, null, new Date('2026-11-02T10:00:00.000Z')),
    ).toBeNull();
  });
});

describe('WeatherDetailPolicy.daylightDuration', () => {
  it('일출부터 일몰까지를 시간·분으로 나눈다', () => {
    // Given 06:51~17:28 When 낮 길이를 구하면 Then 10시간 37분이다
    expect(WeatherDetailPolicy.daylightDuration(DAY)).toEqual({ hours: 10, minutes: 37 });
  });
});

describe('WeatherDetailPolicy.nextFullMoon', () => {
  const daily = createWeatherReport().daily;
  const [today] = daily;

  it('오늘 뒤 처음 오는 보름달 날짜를 찾는다', () => {
    // Given 오늘 하현, 사흘 뒤·닷새 뒤 보름 When 다음 보름을 찾으면 Then 사흘 뒤다
    const forecast =
      today == null
        ? []
        : [
            today,
            { ...today, date: '2026-11-05', moonPhase: 'FULL' as const },
            { ...today, date: '2026-11-07', moonPhase: 'FULL' as const },
          ];

    expect(WeatherDetailPolicy.nextFullMoon(forecast, '2026-11-02')).toBe('2026-11-05');
    expect(WeatherDetailPolicy.nextFullMoon(daily, '2026-11-02')).toBeNull();
  });
});

describe('WeatherDetailPolicy 바람·구름 문구', () => {
  it.each([
    [0.7, 'calm'],
    [3, 'breeze'],
    [8, 'strong'],
  ] as const)('풍속 %s m/s는 %s 바람이다', (speed, level) => {
    // Given 풍속 When 바람 단계를 구하면 Then 보퍼트 기준 단계다
    expect(WeatherDetailPolicy.windLevel(speed)).toBe(level);
  });

  it.each([
    [90, true, 'overcast'],
    [50, true, 'brokenDay'],
    [50, false, 'brokenNight'],
    [10, true, 'clearDay'],
    [0, false, 'clearNight'],
  ] as const)('운량 %s%%, 낮 %s이면 %s 문구다', (cloudCover, isDaylight, note) => {
    // Given 운량과 낮밤 When 구름 문구를 고르면 Then 단계와 낮밤에 맞는 문구다
    expect(WeatherDetailPolicy.cloudCoverNote(cloudCover, isDaylight)).toBe(note);
  });
});
