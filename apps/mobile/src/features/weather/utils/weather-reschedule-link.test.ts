import { range } from 'es-toolkit';
import { z } from 'zod';

import { weatherRescheduleParamsSchema } from '../schemas/weather-reschedule-params.schema';

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
