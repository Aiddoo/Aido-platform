import { todoRepeatSchema, todoSeriesResponseSchema, updateTodoSchema } from '@aido/api';

import type { TodoRepeat } from '../domains/todo-repeat.model';
import { todoSeriesSchema } from '../domains/todo-series.model';
import { toRepeat, toRepeatDto } from './todo-repeat.mapper';
import {
  toFollowingCategoryRequest,
  toFollowingScheduleRequest,
  toTodoSeries,
  toUpdateTodoRequest,
} from './todo-series.mapper';

const DAILY: TodoRepeat = { frequency: 'DAILY', end: { type: 'NEVER' } };
const BIWEEKLY_COUNT: TodoRepeat = {
  frequency: 'WEEKLY',
  interval: 2,
  weekdays: ['TUE'],
  end: { type: 'COUNT', count: 10 },
};

const REPEATS: TodoRepeat[] = [
  DAILY,
  {
    frequency: 'WEEKLY',
    interval: 1,
    weekdays: ['MON', 'FRI'],
    end: { type: 'UNTIL', date: '2026-12-31' },
  },
  BIWEEKLY_COUNT,
  { frequency: 'MONTHLY', monthDay: 31, end: { type: 'NEVER' } },
];

describe('반복 규칙 변환', () => {
  it.each(REPEATS)('계약 모양으로 보내고 되받으면 같은 규칙이다: %j', (repeat) => {
    // Given
    const dto = todoRepeatSchema.parse(toRepeatDto(repeat));

    // When
    const result = toRepeat(dto);

    // Then
    expect(result).toEqual(repeat);
  });
});

describe('toUpdateTodoRequest', () => {
  it('생략은 유지라 옵션이 없으면 범위·규칙 키를 보내지 않는다', () => {
    // When
    const request = toUpdateTodoRequest({ title: '새 제목' }, {});

    // Then
    expect(request).toEqual({ title: '새 제목' });
  });

  it('null은 반복 끝내기라 repeat 키를 null로 보낸다', () => {
    // When
    const request = toUpdateTodoRequest({}, { repeat: null });

    // Then
    expect(request).toEqual({ repeat: null });
  });

  it('규칙 변경은 범위와 함께 계약 모양으로 보낸다', () => {
    // When
    const request = updateTodoSchema.parse(
      toUpdateTodoRequest(
        { title: '새 제목' },
        { scope: 'THIS_AND_FOLLOWING', repeat: BIWEEKLY_COUNT, checklist: [{ title: '준비물' }] },
      ),
    );

    // Then
    expect(request).toEqual({
      title: '새 제목',
      scope: 'THIS_AND_FOLLOWING',
      repeat: {
        frequency: 'WEEKLY',
        interval: 2,
        weekdays: ['TUE'],
        end: { type: 'COUNT', count: 10 },
      },
      checklist: [{ title: '준비물' }],
    });
  });
});

describe('이후 회차까지 고치는 요청', () => {
  it('시간은 PATCH로 보내고 날짜는 보내지 않는다', () => {
    // When
    const request = toFollowingScheduleRequest({
      startDate: '2026-11-05',
      endDate: null,
      scheduledTime: '10:00',
      isAllDay: false,
    });

    // Then
    expect(request).toEqual({
      scheduledTime: '10:00',
      isAllDay: false,
      scope: 'THIS_AND_FOLLOWING',
    });
  });

  it('카테고리도 PATCH로 범위와 함께 보낸다', () => {
    // When
    const request = toFollowingCategoryRequest({ categoryId: 7 });

    // Then
    expect(request).toEqual({ categoryId: 7, scope: 'THIS_AND_FOLLOWING' });
  });
});

describe('toTodoSeries', () => {
  it('규칙 응답에서 앱이 쓰는 값만 옮긴다', () => {
    // When
    const series = toTodoSeries({
      id: 'series-1',
      title: '물 마시기',
      categoryId: 1,
      visibility: 'PUBLIC',
      scheduledTime: '09:00',
      timezone: 'Asia/Seoul',
      repeat: { frequency: 'DAILY', end: { type: 'NEVER' } },
      startDate: '2026-11-02',
      nextOccurrenceDate: '2027-02-01',
      isActive: true,
      checklist: [],
      createdAt: '2026-11-02T00:00:00.000Z',
      updatedAt: '2026-11-02T00:00:00.000Z',
    });

    // Then
    expect(series).toEqual({
      id: 'series-1',
      repeat: { frequency: 'DAILY', end: { type: 'NEVER' } },
      startDate: '2026-11-02',
    });
  });
});

describe('계약 응답과 반복 묶음 모델', () => {
  it('계약을 통과한 반복 묶음을 매핑하면 모델 스키마를 통과한다', () => {
    // Given
    const dto = todoSeriesResponseSchema.parse({
      id: 'series-2',
      title: '격주 회의',
      categoryId: 1,
      visibility: 'PRIVATE',
      scheduledTime: '10:00',
      timezone: 'Asia/Seoul',
      repeat: {
        frequency: 'WEEKLY',
        interval: 2,
        weekdays: ['MON', 'THU'],
        end: { type: 'COUNT', count: 10 },
      },
      startDate: '2026-11-02',
      nextOccurrenceDate: '2026-11-05',
      isActive: true,
      checklist: [],
      createdAt: '2026-11-02T00:00:00.000Z',
      updatedAt: '2026-11-02T00:00:00.000Z',
    });

    // When
    const result = toTodoSeries(dto);

    // Then
    expect(todoSeriesSchema.parse(result)).toEqual(result);
  });
});
