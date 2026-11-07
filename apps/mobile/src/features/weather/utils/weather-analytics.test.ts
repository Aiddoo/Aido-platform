import { ApiError } from '@src/core/errors/api-error';
import { NetworkError, ParseError, ServerError } from '@src/shared/errors/infra-error';

import {
  toWeatherBriefingKind,
  toWeatherLocationRegisteredResult,
  toWeatherOpenedEntry,
  toWeatherReportFailedCause,
} from './weather-analytics';

describe('날씨 분석 값', () => {
  it('진입점 파라미터가 없으면 other로, 있으면 그대로 센다', () => {
    // Given 딥 링크와 피드 배지 진입 / When 진입점을 정하면 / Then 없는 값은 other다
    expect(toWeatherOpenedEntry(undefined)).toBe('other');
    expect(toWeatherOpenedEntry('feed_badge')).toBe('feed_badge');
  });

  it('브리핑 종류는 GA에서 읽기 쉬운 snake_case로 바꾼다', () => {
    // Given camelCase 종류 / When 분석 값으로 바꾸면 / Then snake_case다
    expect(toWeatherBriefingKind('rainLater')).toBe('rain_later');
    expect(toWeatherBriefingKind('noScheduledTodos')).toBe('no_scheduled_todos');
  });

  it.each([
    ['ready', 'located'],
    ['denied', 'denied'],
    ['unavailable', 'unavailable'],
    ['checking', null],
    ['needsPermission', null],
  ] as const)('위치 상태 %p는 등록 결과 %p로 센다', (status, expected) => {
    // Given 위치 상태 / When 등록 결과로 바꾸면 / Then 확인이 끝난 상태만 값이 있다
    expect(toWeatherLocationRegisteredResult(status)).toBe(expected);
  });

  it.each([
    [new ApiError('WEATHER_1902', '위치 없음', 404), 'no_location'],
    [new ServerError(503), 'provider_unavailable'],
    [new NetworkError(), 'offline'],
    [new ParseError('invalid'), 'other'],
  ])('리포트 실패 %p를 원인 %p로 묶는다', (error, expected) => {
    // Given 리포트 실패 / When 원인을 정하면 / Then 오류 메시지 없이 원인 enum만 남는다
    expect(toWeatherReportFailedCause(error)).toBe(expected);
  });
});
