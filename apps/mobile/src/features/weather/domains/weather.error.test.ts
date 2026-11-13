import type { ErrorCodeType } from '@aido/api/errors';
import { ApiError } from '@src/core/errors/api-error';
import { ParseError, ServerError } from '@src/shared/errors/infra-error';

import { isLocationNotRegisteredError, isWeatherProviderUnavailableError } from './weather.error';

describe('isLocationNotRegisteredError', () => {
  it('서버에 위치가 없다는 WEATHER_1902만 위치 등록 안내로 분류한다', () => {
    // Given
    const notRegistered = new ApiError('WEATHER_1902', '위치 정보가 등록되지 않았어요', 404);
    const other = new ApiError('SYS_0001', '오류', 400);

    // When
    const isRegistrationMissing = isLocationNotRegisteredError(notRegistered);
    const isOtherRegistrationMissing = isLocationNotRegisteredError(other);

    // Then
    expect(isRegistrationMissing).toBe(true);
    expect(isOtherRegistrationMissing).toBe(false);
  });
});

describe('isWeatherProviderUnavailableError', () => {
  const serverError = (status: number, serverCode: ErrorCodeType | null) =>
    new ServerError(status, { serverCode, details: null, requestId: null, request: null });

  it.each([
    {
      name: '공급자 장애(503 WEATHER_1901)',
      error: serverError(503, 'WEATHER_1901'),
      expected: true,
    },
    { name: 'DB 과부하(503 SYS_0005)', error: serverError(503, 'SYS_0005'), expected: false },
    { name: '코드 없는 503', error: serverError(503, null), expected: false },
    { name: '서버 오류(500)', error: serverError(500, 'SYS_0001'), expected: false },
  ] as const)('$name은 공급자 장애인지 $expected', ({ error, expected }) => {
    // When
    const isUnavailable = isWeatherProviderUnavailableError(error);

    // Then
    expect(isUnavailable).toBe(expected);
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
