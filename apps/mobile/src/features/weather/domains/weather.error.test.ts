import { ApiError } from '@src/core/errors/api-error';
import { ParseError, ServerError } from '@src/shared/errors/infra-error';

import { isLocationNotRegisteredError, isWeatherProviderUnavailableError } from './weather.error';

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
