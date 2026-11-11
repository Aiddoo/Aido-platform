import { ApiError } from '@src/core/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { createHttpClientStub } from '@src/testing/core';

import { createWeatherReportDto } from '../__tests__/weather-report.fixtures';
import { WeatherService } from './weather.service';

describe('WeatherService.getReport', () => {
  it('v2 날씨를 요청하고 시각을 Instant로 바꾼 리포트를 돌려준다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue({ ok: true, value: createWeatherReportDto() });
    const service = new WeatherService(httpClient);
    const signal = new AbortController().signal;

    // When
    const result = await service.getReport(signal);

    // Then
    expect(httpClient.get).toHaveBeenCalledWith('v2/weather', { signal });
    expect(result.ok && result.value.fetchedAt).toBe('2026-11-02T06:20:00.000Z');
  });

  it('응답이 공유 계약과 다르면 ParseError를 던진다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue({
      ok: true,
      value: { ...createWeatherReportDto(), hourly: null },
    });
    const service = new WeatherService(httpClient);

    // When
    const request = service.getReport();

    // Then
    await expect(request).rejects.toBeInstanceOf(ParseError);
  });

  it('서버 비즈니스 오류는 바꾸지 않고 그대로 돌려준다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    const apiError = new ApiError('WEATHER_1902', '위치 정보가 등록되지 않았어요', 404);
    httpClient.get.mockResolvedValue({ ok: false, error: apiError });
    const service = new WeatherService(httpClient);

    // When
    const result = await service.getReport();

    // Then
    expect(result).toEqual({ ok: false, error: apiError });
  });
});

describe('WeatherService.updateLocation', () => {
  it('좌표를 v2 위치 등록으로 보내고 서버가 정한 시간대를 돌려준다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.put.mockResolvedValue({
      ok: true,
      value: { latitude: 35.6812, longitude: 139.7671, timezone: 'Asia/Tokyo' },
    });
    const service = new WeatherService(httpClient);

    // When
    const result = await service.updateLocation({ latitude: 35.6812, longitude: 139.7671 });

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

  it('위치 응답에 시간대가 없으면 ParseError를 던진다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.put.mockResolvedValue({ ok: true, value: { latitude: 1, longitude: 2 } });
    const service = new WeatherService(httpClient);

    // When
    const request = service.updateLocation({ latitude: 1, longitude: 2 });

    // Then
    await expect(request).rejects.toBeInstanceOf(ParseError);
  });
});
