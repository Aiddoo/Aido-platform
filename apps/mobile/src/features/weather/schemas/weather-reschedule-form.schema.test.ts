import { toInstant } from '@src/shared/date/instant';
import { act, renderHook } from '@testing-library/react-native';
import { useForm } from 'react-hook-form';

import { toScheduleChanges, toSelectionKey } from '../utils/weather-reschedule-form.view-model';
import {
  weatherRescheduleFormSchema,
  type WeatherRescheduleFormValues,
} from './weather-reschedule-form.schema';

describe('weatherRescheduleFormSchema', () => {
  it('할 일 id로 만든 폼 필드에 고른 시각이 검증을 통과해 옮길 대상이 된다', async () => {
    // Given
    const { result } = await renderHook(() =>
      useForm<WeatherRescheduleFormValues>({ defaultValues: { selections: {} } }),
    );

    // When
    await act(() => {
      result.current.setValue(`selections.${toSelectionKey(13)}`, '2026-11-03T02:00:00.000Z');
    });
    const values = weatherRescheduleFormSchema.parse(result.current.getValues());

    // Then
    expect(toScheduleChanges(values, [13])).toEqual([
      { todoId: 13, startsAt: toInstant('2026-11-03T02:00:00.000Z') },
    ]);
  });

  it('시트에 남아 있는 할 일만 고른 시각으로 옮기고, 목록에서 뺀 할 일은 무시한다', () => {
    // Given
    const values = weatherRescheduleFormSchema.parse({
      selections: { 'todo-12': '2026-11-02T10:00:00.000Z', 'todo-15': '2026-11-02T12:00:00.000Z' },
    });

    // When
    const changes = toScheduleChanges(values, [12]);

    // Then
    expect(changes).toEqual([{ todoId: 12, startsAt: toInstant('2026-11-02T10:00:00.000Z') }]);
  });

  it('옮길 시간이 없어 선택이 비어 있는 할 일은 건너뛴다', () => {
    // When
    const changes = toScheduleChanges({ selections: {} }, [12]);

    // Then
    expect(changes).toEqual([]);
  });

  it('ISO 시각이 아닌 값은 거부한다', () => {
    // When
    const result = weatherRescheduleFormSchema.safeParse({ selections: { 'todo-12': '오후 3시' } });

    // Then
    expect(result.success).toBe(false);
  });
});
