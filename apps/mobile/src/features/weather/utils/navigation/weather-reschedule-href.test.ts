import { buildWeatherRescheduleDeepLink } from '@aido/api';

import {
  parseWeatherRescheduleUrl,
  rescheduleTodoIdsParamSchema,
  toRescheduleTodoIdsParam,
} from './weather-reschedule-href';

describe('rescheduleTodoIdsParamSchema', () => {
  it.each([
    ['12,15', [12, 15]],
    ['7', [7]],
  ])('todoIds=%s를 할 일 id 목록으로 읽는다', (todoIds, expected) => {
    // When
    const result = rescheduleTodoIdsParamSchema.safeParse({ todoIds });

    // Then
    expect(result.success && result.data.todoIds).toEqual(expected);
  });

  it.each([undefined, '', 'abc', '0', '1,,2', '01', '1.5'])(
    'todoIds=%s처럼 잘못된 값은 거부한다',
    (todoIds) => {
      // When
      const result = rescheduleTodoIdsParamSchema.safeParse({ todoIds });

      // Then
      expect(result.success).toBe(false);
    },
  );

  it('한 번에 옮길 할 일은 50개까지만 받는다', () => {
    // Given 50개와 51개 id
    const ids = (count: number) => Array.from({ length: count }, (_, index) => index + 1).join(',');

    // When / Then
    expect(rescheduleTodoIdsParamSchema.safeParse({ todoIds: ids(50) }).success).toBe(true);
    expect(rescheduleTodoIdsParamSchema.safeParse({ todoIds: ids(51) }).success).toBe(false);
  });

  it('할 일 id 목록을 같은 형식의 URL 값으로 되돌린다', () => {
    // When
    const param = toRescheduleTodoIdsParam([12, 15]);

    // Then
    expect(rescheduleTodoIdsParamSchema.parse({ todoIds: param }).todoIds).toEqual([12, 15]);
  });
});

describe('parseWeatherRescheduleUrl', () => {
  it('알림 링크의 할 일 id와 이유를 옮기기 시트 경로로 읽는다', () => {
    // Given 더위로 할 일 두 개를 옮기는 링크 When 읽으면 Then 같은 id·이유의 시트 경로다
    expect(parseWeatherRescheduleUrl('/weather/reschedule?todoIds=12,15&reason=heat')).toEqual({
      pathname: '/weather/reschedule',
      params: { todoIds: '12,15', reason: 'heat' },
    });
  });

  it('이유가 없거나 낯설면 비를 피하는 것으로 읽는다', () => {
    // Given 이유 없는 링크와 모르는 이유 When 읽으면 Then 비로 연다
    expect(parseWeatherRescheduleUrl('/weather/reschedule?todoIds=7')?.params.reason).toBe('rain');
    expect(
      parseWeatherRescheduleUrl('/weather/reschedule?todoIds=7&reason=wind')?.params.reason,
    ).toBe('rain');
  });

  it.each([
    undefined,
    '/weather',
    '/weather/reschedule?todoIds=',
    '/weather/reschedule?todoIds=a,b',
    '/feed?todoIds=1',
    '/weather/reschedule/extra?todoIds=1',
    'https://evil.example/weather/reschedule?todoIds=1',
  ])('%s는 옮기기 링크가 아니라 null이다', (url) => {
    // Given 다른 경로·잘못된 id When 읽으면 Then null이다
    expect(parseWeatherRescheduleUrl(url)).toBeNull();
  });

  it('서버가 만든 옮기기 링크를 그대로 읽는다', () => {
    // Given 공용 계약으로 만든 링크 When 읽으면 Then 같은 id·이유다
    const url = buildWeatherRescheduleDeepLink([3, 4], 'heat');

    expect(parseWeatherRescheduleUrl(url)?.params).toEqual({ todoIds: '3,4', reason: 'heat' });
  });
});
