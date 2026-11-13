import { todoSeriesResponseSchema } from '@aido/api';

import { todoSeriesSchema } from '../domains/todo-series.model';
import {
  toFollowingCategoryRequest,
  toFollowingScheduleRequest,
  toTodoSeries,
} from './todo-series.mapper';

describe('toFollowingScheduleRequest', () => {
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
