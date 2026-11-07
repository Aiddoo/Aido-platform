import { ApiError } from '@src/core/errors/api-error';
import { NetworkError, ParseError, ServerError } from '@src/shared/errors/infra-error';

import {
  toPermissionResult,
  toWeatherBriefingKind,
  toWeatherLocationRegisteredResult,
  toWeatherOpenedEntry,
  toWeatherReportFailedCause,
} from './weather-analytics';

describe('날씨 분석 값', () => {
  it('진입점 파라미터가 없으면 other로, 있으면 그대로 센다', () => {
    // When
    const withoutEntry = toWeatherOpenedEntry(undefined);
    const withEntry = toWeatherOpenedEntry('feed_badge');

    // Then
    expect(withoutEntry).toBe('other');
    expect(withEntry).toBe('feed_badge');
  });

  it('브리핑 종류는 GA에서 읽기 쉬운 snake_case로 바꾼다', () => {
    // When
    const rainLater = toWeatherBriefingKind('rainLater');
    const noScheduledTodos = toWeatherBriefingKind('noScheduledTodos');

    // Then
    expect(rainLater).toBe('rain_later');
    expect(noScheduledTodos).toBe('no_scheduled_todos');
  });

  it.each([
    ['ready', 'located'],
    ['denied', 'denied'],
    ['unavailable', 'unavailable'],
    ['checking', null],
    ['needsPermission', null],
  ] as const)('위치 상태 %p는 등록 결과 %p로 센다', (status, expected) => {
    // When
    const result = toWeatherLocationRegisteredResult(status);

    // Then
    expect(result).toBe(expected);
  });

  it.each([
    [new ApiError('WEATHER_1902', '위치 없음', 404), 'no_location'],
    [new ServerError(503), 'provider_unavailable'],
    [new NetworkError(), 'offline'],
    [new ParseError('invalid'), 'other'],
  ])('리포트 실패 %p를 원인 %p로 묶는다', (error, expected) => {
    // When
    const cause = toWeatherReportFailedCause(error);

    // Then
    expect(cause).toBe(expected);
  });
});

describe('toPermissionResult', () => {
  it.each([
    [{ isGranted: true, canAskAgain: true }, 'granted'],
    [{ isGranted: false, canAskAgain: true }, 'needs_permission'],
    [{ isGranted: false, canAskAgain: false }, 'denied'],
    [null, 'needs_permission'],
  ] as const)('권한 요청 결과 %o는 %s로 기록한다', (permission, expected) => {
    // When
    const result = toPermissionResult(permission);

    // Then
    expect(result).toBe(expected);
  });
});
