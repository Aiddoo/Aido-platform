import { ApiError } from '@src/shared/errors/api-error';
import {
  NetworkError,
  ParseError,
  ServerError,
  TimeoutError,
} from '@src/shared/errors/infra-error';

import {
  isConnectionError,
  isLocationNotRegisteredError,
  isWeatherProviderUnavailableError,
} from './weather.error';

describe('날씨 오류 판별', () => {
  it('서버에 위치가 없다는 WEATHER_1902만 위치 등록 안내로 분류한다', () => {
    // Given
    const notRegistered = new ApiError('WEATHER_1902', '위치 정보가 등록되지 않았어요', 404);
    const other = new ApiError('SYS_0001', '오류', 400);

    // Then
    expect(isLocationNotRegisteredError(notRegistered)).toBe(true);
    expect(isLocationNotRegisteredError(other)).toBe(false);
  });

  it('공급자 장애(WEATHER_1901)는 503 ServerError로 오므로 503만 공급자 장애로 분류한다', () => {
    // Then
    expect(isWeatherProviderUnavailableError(new ServerError(503))).toBe(true);
    expect(isWeatherProviderUnavailableError(new ServerError(500))).toBe(false);
  });

  it('네트워크 끊김과 시간 초과는 연결 오류로, 응답 파싱 실패는 일반 오류로 분류한다', () => {
    // Then
    expect(isConnectionError(new NetworkError())).toBe(true);
    expect(isConnectionError(new TimeoutError())).toBe(true);
    expect(isConnectionError(new ParseError('invalid'))).toBe(false);
    expect(isWeatherProviderUnavailableError(new ParseError('invalid'))).toBe(false);
  });
});
