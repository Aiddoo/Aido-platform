import { buildWeatherRescheduleDeepLink } from '@aido/api';
import { range } from 'es-toolkit';
import { z } from 'zod';

import { weatherRescheduleParamsSchema } from '../schemas/weather-reschedule-params.schema';
import { parseWeatherRescheduleUrl } from './weather-reschedule-link';

const rescheduleTodoIdsParamSchema = weatherRescheduleParamsSchema.pick({ todoIds: true });

describe('weatherRescheduleParamsSchema', () => {
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
    // Given
    const ids = (count: number) =>
      range(count)
        .map((index) => index + 1)
        .join(',');

    // When
    const atLimit = rescheduleTodoIdsParamSchema.safeParse({ todoIds: ids(50) });
    const overLimit = rescheduleTodoIdsParamSchema.safeParse({ todoIds: ids(51) });

    // Then
    expect(atLimit.success).toBe(true);
    expect(overLimit.success).toBe(false);
  });

  it('할 일 id 목록을 같은 형식의 URL 값으로 되돌린다', () => {
    // When
    const { todoIds } = z.encode(rescheduleTodoIdsParamSchema, { todoIds: [12, 15] });

    // Then
    expect(todoIds).toBe('12,15');
    expect(rescheduleTodoIdsParamSchema.parse({ todoIds }).todoIds).toEqual([12, 15]);
  });
});

describe('parseWeatherRescheduleUrl', () => {
  it('알림 링크의 할 일 id와 이유를 옮기기 시트 경로로 읽는다', () => {
    // When
    const route = parseWeatherRescheduleUrl('/weather/reschedule?todoIds=12,15&reason=heat');

    // Then
    expect(route).toEqual({
      pathname: '/weather/reschedule',
      params: { todoIds: '12,15', reason: 'heat' },
    });
  });

  it('이유가 없거나 낯설면 비를 피하는 것으로 읽는다', () => {
    // When
    const withoutReason = parseWeatherRescheduleUrl('/weather/reschedule?todoIds=7');
    const withUnknownReason = parseWeatherRescheduleUrl(
      '/weather/reschedule?todoIds=7&reason=wind',
    );

    // Then
    expect(withoutReason?.params.reason).toBe('rain');
    expect(withUnknownReason?.params.reason).toBe('rain');
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
    // When
    const route = parseWeatherRescheduleUrl(url);

    // Then
    expect(route).toBeNull();
  });

  it('서버가 만든 옮기기 링크를 그대로 읽는다', () => {
    // Given
    const url = buildWeatherRescheduleDeepLink([3, 4], 'heat');

    // When
    const route = parseWeatherRescheduleUrl(url);

    // Then
    expect(route?.params).toEqual({ todoIds: '3,4', reason: 'heat' });
  });
});
