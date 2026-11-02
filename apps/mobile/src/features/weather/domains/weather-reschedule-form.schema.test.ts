import {
  toMovedScheduleInput,
  toOriginalScheduleInput,
  toScheduleChanges,
  weatherRescheduleFormSchema,
} from './weather-reschedule-form.schema';

describe('weatherRescheduleFormSchema', () => {
  it('시트에 남아 있는 할 일만 고른 시각으로 옮기고, 목록에서 뺀 할 일은 무시한다', () => {
    // Given
    const values = weatherRescheduleFormSchema.parse({
      selections: { '12': '2026-11-02T10:00:00.000Z', '15': '2026-11-02T12:00:00.000Z' },
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
    const result = weatherRescheduleFormSchema.safeParse({ selections: { '12': '오후 3시' } });

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
    const scheduledAtMs = new Date(2026, 10, 2, 16, 30).getTime();

    // When
    const timed = toOriginalScheduleInput({
      startDate: '2026-11-02',
      endDate: '2026-11-03',
      scheduledAtMs,
      isAllDay: false,
    });
    const allDay = toOriginalScheduleInput({
      startDate: '2026-11-02',
      endDate: null,
      scheduledAtMs,
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
