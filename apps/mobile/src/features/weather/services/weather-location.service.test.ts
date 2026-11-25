import type { LocationGateway } from '@src/core/ports/location-gateway';
import type { OsPermission } from '@src/core/ports/os-permission';
import type { ApiError } from '@src/shared/errors';
import { fail, NetworkError, ok, type Result } from '@src/shared/errors';
import { readStoredValue, writeStoredValue } from '@src/shared/storage/define-stored-value';
import {
  createAppLoggerStub,
  createHttpClientStub,
  createLocationGatewayStub,
  createMemorySyncStorage,
  createApiError,
} from '@src/testing/core';
import { setupFakeTimersPerTest } from '@src/testing/timers';

import { WeatherApi } from '../apis/weather.api';
import type { LocationReading } from '../domains/location-reading.model';
import { weatherLocationPermissionGrantedStoredValue } from '../schemas/weather-location-permission-storage.schema';
import { WeatherLocationService } from './weather-location.service';

type Place = Awaited<ReturnType<LocationGateway['getPlace']>>;

const SEOUL = { latitude: 37.5636, longitude: 126.9976 };
const SEOUL_REGISTERED = { ...SEOUL, timezone: 'Asia/Seoul' };
const SEOUL_PLACE: Place = { countryCode: 'KR', name: { city: '서울', district: '중구' } };
const UNKNOWN_PLACE: Place = { countryCode: null, name: null };
const NOT_ASKED: OsPermission = { status: 'undetermined', canAskAgain: true };

setupFakeTimersPerTest();

/** 역지오코딩과 위치 등록은 테스트가 풀 때까지 끝나지 않는다 */
function setup() {
  const gateway = createLocationGatewayStub({
    permission: { status: 'granted', canAskAgain: true },
    coordinates: SEOUL,
  });
  const place = Promise.withResolvers<Place>();
  gateway.getPlace.mockReturnValue(place.promise);
  const httpClient = createHttpClientStub();
  const registration = Promise.withResolvers<Result<unknown, ApiError>>();
  httpClient.put.mockReturnValue(registration.promise);
  const logger = createAppLoggerStub();
  const onUnexpectedFailure = jest.fn();
  const storage = createMemorySyncStorage();
  const service = new WeatherLocationService({
    gateway,
    weatherApi: new WeatherApi(httpClient, logger),
    storage,
    logger,
  });
  const resolveLocation = (previous?: LocationReading) =>
    service.resolveLocation({
      previous,
      signal: new AbortController().signal,
      findReportLocation: async () => null,
      onUnexpectedFailure,
    });
  const hasRememberedGrant = () =>
    readStoredValue(storage, weatherLocationPermissionGrantedStoredValue);
  const rememberGrant = () =>
    writeStoredValue(storage, weatherLocationPermissionGrantedStoredValue, true);
  return {
    service,
    gateway,
    httpClient,
    place,
    registration,
    logger,
    onUnexpectedFailure,
    resolveLocation,
    hasRememberedGrant,
    rememberGrant,
  };
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
    const rejected = createApiError('SYS_0001', { message: '오류', status: 400 });

    // When
    const resolving = resolveLocation();
    place.resolve(SEOUL_PLACE);
    registration.resolve(fail(rejected));
    const result = await resolving;

    // Then
    expect(result).toEqual(fail(rejected));
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

  describe('권한 확인', () => {
    it('앱을 켠 직후 허용 전으로 읽혀도 기기가 허용을 기억하면 다시 확인해 위치를 읽는다', async () => {
      // Given
      const { gateway, place, registration, resolveLocation, hasRememberedGrant, rememberGrant } =
        setup();
      gateway.getPermission.mockResolvedValue(NOT_ASKED);
      rememberGrant();

      // When
      const resolving = resolveLocation();
      place.resolve(SEOUL_PLACE);
      registration.resolve(ok(SEOUL_REGISTERED));
      const result = await resolving;

      // Then
      expect(gateway.recheckPermission).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject(ok({ status: 'located', isLastKnown: false }));
      expect(hasRememberedGrant()).toBe(true);
    });

    it('처음 쓰는 사용자는 다시 확인하지 않고 위치 안내를 보여 준다', async () => {
      // Given
      const { gateway, resolveLocation } = setup();
      gateway.getPermission.mockResolvedValue(NOT_ASKED);

      // When
      const result = await resolveLocation();

      // Then
      expect(result).toEqual(ok({ status: 'needsPermission' }));
      expect(gateway.recheckPermission).not.toHaveBeenCalled();
    });

    it('다시 확인한 결과가 다시 물을 수 없는 거부면 설정 열기 상태가 되고 기억한 허용을 지운다', async () => {
      // Given
      const { gateway, resolveLocation, hasRememberedGrant, rememberGrant } = setup();
      gateway.getPermission.mockResolvedValue(NOT_ASKED);
      gateway.recheckPermission.mockResolvedValue({ status: 'denied', canAskAgain: false });
      rememberGrant();

      // When
      const result = await resolveLocation();

      // Then
      expect(result).toEqual(ok({ status: 'denied' }));
      expect(hasRememberedGrant()).toBe(false);
    });

    it('허용으로 읽히면 기기에 허용을 기억한다', async () => {
      // Given
      const { place, registration, resolveLocation, hasRememberedGrant } = setup();

      // When
      const resolving = resolveLocation();
      place.resolve(SEOUL_PLACE);
      registration.resolve(ok(SEOUL_REGISTERED));
      await resolving;

      // Then
      expect(hasRememberedGrant()).toBe(true);
    });
  });
});

describe('WeatherLocationService.requestPermission', () => {
  it('허용하면 기기에 허용을 기억하고 OS 값을 그대로 돌려준다', async () => {
    // Given
    const { service, gateway, hasRememberedGrant } = setup();

    // When
    const permission = await service.requestPermission();

    // Then
    expect(permission).toEqual({ status: 'granted', canAskAgain: true });
    expect(gateway.requestPermission).toHaveBeenCalledTimes(1);
    expect(hasRememberedGrant()).toBe(true);
  });

  it('권한 창을 띄우지 못하면 던지지 않고 경고만 남겨 안내가 그대로 남는다', async () => {
    // Given
    const { service, gateway, logger } = setup();
    gateway.requestPermission.mockRejectedValue(new Error('permission unavailable'));

    // When
    const permission = await service.requestPermission();

    // Then
    expect(permission).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith('weather.location-permission-request.failed', {
      error: 'permission unavailable',
    });
  });
});
