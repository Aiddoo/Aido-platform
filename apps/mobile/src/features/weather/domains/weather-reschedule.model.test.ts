import { toInstant } from '@src/shared/date/instant';

import { WeatherReschedulePolicy } from './weather-reschedule.model';

describe('할 일 일정 입력 변환', () => {
  it('옮길 때는 날짜를 그대로 두고 기기 시간대의 시각만 바꾼다', () => {
    // Given
    const startsAt = toInstant(new Date(2026, 10, 2, 19, 0).toISOString());

    // When
    const input = WeatherReschedulePolicy.getMovedScheduleInput(
      { startDate: '2026-11-02', endDate: null },
      startsAt,
      'Asia/Seoul',
    );

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
    const timed = WeatherReschedulePolicy.getOriginalScheduleInput({
      startDate: '2026-11-02',
      endDate: '2026-11-03',
      localTime,
      isAllDay: false,
    });
    const allDay = WeatherReschedulePolicy.getOriginalScheduleInput({
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

describe('getRescheduleTargets', () => {
  const changes = [
    { todoId: 12, startsAt: toInstant('2026-11-02T10:00:00.000Z') },
    { todoId: 15, startsAt: toInstant('2026-11-02T12:00:00.000Z') },
  ];

  it('시트를 연 사이 지워진 할 일은 옮기지 않는다', () => {
    // Given: 15번은 목록에서 사라졌다
    const todos = [{ id: 12, completed: false }];

    // When
    const targets = WeatherReschedulePolicy.getRescheduleTargets(changes, todos);

    // Then
    expect(targets).toEqual([{ todo: todos[0], startsAt: toInstant('2026-11-02T10:00:00.000Z') }]);
  });

  it('시트를 연 사이 완료한 할 일은 옮기지 않는다', () => {
    // Given
    const todos = [
      { id: 12, completed: true },
      { id: 15, completed: false },
    ];

    // When
    const targets = WeatherReschedulePolicy.getRescheduleTargets(changes, todos);

    // Then
    expect(targets.map(({ todo }) => todo.id)).toEqual([15]);
  });

  it('자정이 지나 오늘 목록에 없는 할 일만 남았으면 옮길 것이 없다', () => {
    // When
    const targets = WeatherReschedulePolicy.getRescheduleTargets(changes, [
      { id: 99, completed: false },
    ]);

    // Then
    expect(targets).toEqual([]);
  });
});
