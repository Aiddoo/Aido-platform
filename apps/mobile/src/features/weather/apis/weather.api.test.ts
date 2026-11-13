import { createHttpClientStub, createAppLoggerStub } from '@src/testing/core';

import { createWeatherReportDto } from '../__tests__/weather-report.fixtures';
import { WeatherApi } from './weather.api';

describe('WeatherApi.getReport', () => {
  it('v2 날씨를 요청하고 시각을 Instant로 바꾼 리포트를 돌려준다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue({ ok: true, value: createWeatherReportDto() });
    const api = new WeatherApi(httpClient, createAppLoggerStub());
    const signal = new AbortController().signal;

    // When
    const result = await api.getReport(signal);

    // Then
    expect(httpClient.get).toHaveBeenCalledWith('v2/weather', { signal });
    expect(result.ok && result.value.fetchedAt).toBe('2026-11-02T06:20:00.000Z');
  });

  it('서버가 모르는 열거 값을 보내도 그 칸만 대체값으로 읽고 칸 경로만 기록한다', async () => {
    // Given
    const dto = createWeatherReportDto();
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue({
      ok: true,
      value: {
        ...dto,
        current: { ...dto.current, condition: 'BLIZZARD' },
        hourly: dto.hourly.map((hour) => ({ ...hour, precipitationType: 'FREEZING_RAIN' })),
        airQuality: { pm10: 30, pm25: 15, source: 'NEW_SOURCE' },
      },
    });
    const logger = createAppLoggerStub();
    const api = new WeatherApi(httpClient, logger);

    // When
    const result = await api.getReport();

    // Then
    expect(result.ok && result.value.current.condition).toBe('CLOUDY');
    expect(result.ok && result.value.airQuality).toBeNull();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith('weather.report.enum-fallback', {
      fields: 'current.condition,hourly[].precipitationType,airQuality',
    });
  });
});

describe('WeatherApi.updateLocation', () => {
  it('좌표를 v2 위치 등록으로 보내고 서버가 정한 시간대를 돌려준다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.put.mockResolvedValue({
      ok: true,
      value: { latitude: 35.6812, longitude: 139.7671, timezone: 'Asia/Tokyo' },
    });
    const api = new WeatherApi(httpClient, createAppLoggerStub());

    // When
    const result = await api.updateLocation({ latitude: 35.6812, longitude: 139.7671 });

    // Then
    expect(httpClient.put).toHaveBeenCalledWith(
      'v2/weather/location',
      { latitude: 35.6812, longitude: 139.7671 },
      { signal: undefined },
    );
    expect(result).toEqual({
      ok: true,
      value: { latitude: 35.6812, longitude: 139.7671, timezone: 'Asia/Tokyo' },
    });
  });
});
