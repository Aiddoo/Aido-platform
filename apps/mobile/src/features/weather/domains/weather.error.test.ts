import { ApiError } from '@src/core/errors/api-error';
import {
  isConnectivityError,
  NetworkError,
  ParseError,
  ServerError,
  TimeoutError,
} from '@src/shared/errors/infra-error';

import {
  isOfflineError,
  isTimeoutError,
  isLocationNotRegisteredError,
  isWeatherProviderUnavailableError,
} from './weather.error';

describe('isLocationNotRegisteredError', () => {
  it('서버에 위치가 없다는 WEATHER_1902만 위치 등록 안내로 분류한다', () => {
    // Given
    const notRegistered = new ApiError('WEATHER_1902', '위치 정보가 등록되지 않았어요', 404);
    const other = new ApiError('SYS_0001', '오류', 400);

    // When
    const isNotRegistered = isLocationNotRegisteredError(notRegistered);
    const isOtherNotRegistered = isLocationNotRegisteredError(other);

    // Then
    expect(isNotRegistered).toBe(true);
    expect(isOtherNotRegistered).toBe(false);
  });
});

describe('isWeatherProviderUnavailableError', () => {
  it('공급자 장애(WEATHER_1901)는 503 ServerError로 오므로 503만 공급자 장애로 분류한다', () => {
    // Given
    const unavailable = new ServerError(503);
    const internal = new ServerError(500);

    // When
    const isUnavailable = isWeatherProviderUnavailableError(unavailable);
    const isInternalUnavailable = isWeatherProviderUnavailableError(internal);

    // Then
    expect(isUnavailable).toBe(true);
    expect(isInternalUnavailable).toBe(false);
  });

  it('응답 파싱 실패는 공급자 장애가 아닌 일반 오류로 분류한다', () => {
    // Given
    const parseError = new ParseError('invalid');

    // When
    const isUnavailable = isWeatherProviderUnavailableError(parseError);

    // Then
    expect(isUnavailable).toBe(false);
  });
});

describe('isConnectivityError', () => {
  it('네트워크 끊김과 시간 초과는 연결 오류로, 응답 파싱 실패는 일반 오류로 분류한다', () => {
    // Given
    const network = new NetworkError();
    const timeout = new TimeoutError();
    const parse = new ParseError('invalid');

    // When
    const isNetworkConnectivity = isConnectivityError(network);
    const isTimeoutConnectivity = isConnectivityError(timeout);
    const isParseConnectivity = isConnectivityError(parse);

    // Then
    expect(isNetworkConnectivity).toBe(true);
    expect(isTimeoutConnectivity).toBe(true);
    expect(isParseConnectivity).toBe(false);
  });
});

describe('isOfflineError', () => {
  it('네트워크 끊김만 연결 끊김으로 보고 시간 초과는 따로 분류한다', () => {
    // Given
    const network = new NetworkError();
    const timeout = new TimeoutError();

    // When
    const isNetworkOffline = isOfflineError(network);
    const isTimeoutOffline = isOfflineError(timeout);

    // Then
    expect(isNetworkOffline).toBe(true);
    expect(isTimeoutOffline).toBe(false);
  });
});

describe('isTimeoutError', () => {
  it('시간 초과만 시간 초과로 분류한다', () => {
    // Given
    const timeout = new TimeoutError();
    const network = new NetworkError();

    // When
    const isTimeout = isTimeoutError(timeout);
    const isNetworkTimeout = isTimeoutError(network);

    // Then
    expect(isTimeout).toBe(true);
    expect(isNetworkTimeout).toBe(false);
  });
});
