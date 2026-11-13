import type { LocationGateway } from '@src/core/ports/location-gateway';
import { ApiError, err, NetworkError, ok, type Result } from '@src/shared/errors';
import {
  createAppLoggerStub,
  createHttpClientStub,
  createLocationGatewayStub,
} from '@src/testing/core';
import { setupFakeTimersPerTest } from '@src/testing/timers';

import { WeatherApi } from '../apis/weather.api';
import type { LocationReading } from '../domains/weather-location.model';
import { WeatherLocationService } from './weather-location.service';

type Place = Awaited<ReturnType<LocationGateway['getPlace']>>;

const SEOUL = { latitude: 37.5636, longitude: 126.9976 };
const SEOUL_REGISTERED = { ...SEOUL, timezone: 'Asia/Seoul' };
const SEOUL_PLACE: Place = { countryCode: 'KR', name: { city: '서울', district: '중구' } };
const UNKNOWN_PLACE: Place = { countryCode: null, name: null };

setupFakeTimersPerTest();

/** 역지오코딩과 위치 등록은 테스트가 풀 때까지 끝나지 않는다 */
function setup() {
  const gateway = createLocationGatewayStub();
  gateway.getPermission.mockResolvedValue({ isGranted: true, canAskAgain: true });
  gateway.getCoordinates.mockResolvedValue(SEOUL);
  const place = Promise.withResolvers<Place>();
  gateway.getPlace.mockReturnValue(place.promise);
  const httpClient = createHttpClientStub();
  const registration = Promise.withResolvers<Result<unknown, ApiError>>();
  httpClient.put.mockReturnValue(registration.promise);
  const logger = createAppLoggerStub();
  const onUnexpectedFailure = jest.fn();
  const service = new WeatherLocationService({
    gateway,
    weatherApi: new WeatherApi(httpClient, logger),
    logger,
  });
  const resolveLocation = (previous?: LocationReading) =>
    service.resolveLocation({
      previous,
      signal: new AbortController().signal,
      findReportLocation: async () => null,
      onUnexpectedFailure,
    });
  return { gateway, httpClient, place, registration, logger, onUnexpectedFailure, resolveLocation };
}

describe('WeatherLocationService.resolveLocation', () => {
  it('새 위치를 등록할 때 역지오코딩과 위치 등록을 함께 시작한다', async () => {
    // Given
    const { gateway, httpClient, place, registration, resolveLocation } = setup();

    // When
    const resolving = resolveLocation();
    await jest.advanceTimersByTimeAsync(0);
    const startedBeforeEitherSettled = {
      place: gateway.getPlace.mock.calls.length,
      registration: httpClient.put.mock.calls.length,
    };
    place.resolve(SEOUL_PLACE);
    registration.resolve(ok(SEOUL_REGISTERED));
    await resolving;

    // Then
    expect(startedBeforeEitherSettled).toEqual({ place: 1, registration: 1 });
  });

  it.each([
    { found: '장소 이름을 찾으면', resolvedPlace: SEOUL_PLACE },
    { found: '장소 이름을 찾지 못해도', resolvedPlace: UNKNOWN_PLACE },
  ])('$found 등록한 위치로 새 리비전의 위치가 된다', async ({ resolvedPlace }) => {
    // Given
    const { place, registration, resolveLocation } = setup();

    // When
    const resolving = resolveLocation();
    place.resolve(resolvedPlace);
    registration.resolve(ok(SEOUL_REGISTERED));
    const result = await resolving;

    // Then
    expect(result).toEqual(
      ok({
        status: 'located',
        registered: SEOUL_REGISTERED,
        place: resolvedPlace.name,
        countryCode: resolvedPlace.countryCode,
        isLastKnown: false,
        revision: 1,
      }),
    );
  });

  it('서버가 등록을 거절하면 장소 이름을 받아도 거절을 돌려주고 경고를 남긴다', async () => {
    // Given
    const { place, registration, logger, onUnexpectedFailure, resolveLocation } = setup();
    const rejected = new ApiError('SYS_0001', '오류', 400);

    // When
    const resolving = resolveLocation();
    place.resolve(SEOUL_PLACE);
    registration.resolve(err(rejected));
    const result = await resolving;

    // Then
    expect(result).toEqual(err(rejected));
    expect(logger.warn).toHaveBeenCalledWith('weather.location-register.failed', {
      serverErrorCode: 'SYS_0001',
    });
    expect(onUnexpectedFailure).not.toHaveBeenCalled();
  });

  it('등록 요청이 연결 오류로 실패하면 보고한 뒤 다시 던진다', async () => {
    // Given
    const { place, registration, onUnexpectedFailure, resolveLocation } = setup();
    const offline = new NetworkError();

    // When
    const resolving = resolveLocation();
    place.resolve(SEOUL_PLACE);
    registration.reject(offline);

    // Then
    await expect(resolving).rejects.toBe(offline);
    expect(onUnexpectedFailure).toHaveBeenCalledWith({ step: 'register', error: offline });
  });

  it('직전 위치와 같은 격자면 다시 등록하지 않고 장소 이름만 새로 고친다', async () => {
    // Given
    const { httpClient, place, resolveLocation } = setup();
    const previous: LocationReading = {
      status: 'located',
      registered: SEOUL_REGISTERED,
      place: { city: '서울', district: null },
      countryCode: 'KR',
      isLastKnown: true,
      revision: 3,
    };

    // When
    const resolving = resolveLocation(previous);
    place.resolve(SEOUL_PLACE);
    const result = await resolving;

    // Then
    expect(result).toEqual(ok({ ...previous, place: SEOUL_PLACE.name, isLastKnown: false }));
    expect(httpClient.put).not.toHaveBeenCalled();
  });
});
