import { act, renderHook } from '@testing-library/react-native';
import { useForm } from 'react-hook-form';

import {
  toMovedScheduleInput,
  toOriginalScheduleInput,
  toRescheduleTargets,
  toScheduleChanges,
  toSelectionKey,
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
      { todoId: 13, startsAt: new Date('2026-11-03T02:00:00.000Z') },
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
    expect(changes).toEqual([{ todoId: 12, startsAt: new Date('2026-11-02T10:00:00.000Z') }]);
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

describe('할 일 일정 입력 변환', () => {
  it('옮길 때는 날짜를 그대로 두고 기기 시간대의 시각만 바꾼다', () => {
    // Given
    const startsAt = new Date(2026, 10, 2, 19, 0);

    // When
    const input = toMovedScheduleInput({ startDate: '2026-11-02', endDate: null }, startsAt);

    // Then
    expect(input).toEqual({
      startDate: '2026-11-02',
      endDate: null,
      scheduledTime: '19:00',
      isAllDay: false,
    });
  });

  it('되돌릴 때는 원래 시각을, 종일이었다면 시각 없이 종일로 되돌린다', () => {
    // Given
    const localTime = '16:30';

    // When
    const timed = toOriginalScheduleInput({
      startDate: '2026-11-02',
      endDate: '2026-11-03',
      localTime,
      isAllDay: false,
    });
    const allDay = toOriginalScheduleInput({
      startDate: '2026-11-02',
      endDate: null,
      localTime,
      isAllDay: true,
    });

    // Then
    expect(timed).toEqual({
      startDate: '2026-11-02',
      endDate: '2026-11-03',
      scheduledTime: '16:30',
      isAllDay: false,
    });
    expect(allDay).toMatchObject({ scheduledTime: null, isAllDay: true });
  });
});

describe('toRescheduleTargets', () => {
  const values = {
    selections: { 'todo-12': '2026-11-02T10:00:00.000Z', 'todo-15': '2026-11-02T12:00:00.000Z' },
  };

  it('시트를 연 사이 지워진 할 일은 옮기지 않는다', () => {
    // Given: 15번은 목록에서 사라졌다
    const todos = [{ id: 12, completed: false }];

    // When
    const targets = toRescheduleTargets(values, [12, 15], todos);

    // Then
    expect(targets).toEqual([{ todo: todos[0], startsAt: new Date('2026-11-02T10:00:00.000Z') }]);
  });

  it('시트를 연 사이 완료한 할 일은 옮기지 않는다', () => {
    // Given
    const todos = [
      { id: 12, completed: true },
      { id: 15, completed: false },
    ];

    // When
    const targets = toRescheduleTargets(values, [12, 15], todos);

    // Then
    expect(targets.map(({ todo }) => todo.id)).toEqual([15]);
  });

  it('자정이 지나 오늘 목록에 없는 할 일만 남았으면 옮길 것이 없다', () => {
    // When
    const targets = toRescheduleTargets(values, [12, 15], [{ id: 99, completed: false }]);

    // Then
    expect(targets).toEqual([]);
  });
});
