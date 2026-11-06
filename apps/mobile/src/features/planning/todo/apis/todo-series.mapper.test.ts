import { createTodoSchema, todoRepeatSchema, updateTodoSchema } from '@aido/api';

import type { TodoRepeat } from '../domains/todo-repeat.model';
import {
  type RepeatingTodoDraft,
  toCreateRepeatingTodoRequest,
  toFollowingCategoryRequest,
  toFollowingScheduleRequest,
  toRepeat,
  toRepeatDto,
  toTodoSeries,
  toUpdateTodoRequest,
} from './todo-series.mapper';

const createDraft = (
  repeat: TodoRepeat,
  overrides: Partial<RepeatingTodoDraft> = {},
): RepeatingTodoDraft => ({
  title: '약 먹기',
  categoryId: 3,
  startDate: '2026-11-02',
  isAllDay: false,
  scheduledTime: '09:00',
  visibility: 'PUBLIC',
  repeat,
  ...overrides,
});

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
  test.each(REPEATS)('계약 모양으로 보내고 되받으면 같은 규칙이다: %j', (repeat) => {
    // Given
    const dto = todoRepeatSchema.parse(toRepeatDto(repeat));

    // When
    const result = toRepeat(dto);

    // Then
    expect(result).toEqual(repeat);
  });
});

describe('toCreateRepeatingTodoRequest', () => {
  test('격주·매월·끝없는 반복도 POST /v1/todos의 repeat로 보낸다', () => {
    // Given
    const draft = createDraft({ frequency: 'MONTHLY', monthDay: 9, end: { type: 'NEVER' } });

    // When
    const request = createTodoSchema.parse(toCreateRepeatingTodoRequest(draft));

    // Then
    expect(request.repeat).toEqual({ frequency: 'MONTHLY', monthDay: 9, end: { type: 'NEVER' } });
    expect(request.endDate).toBeUndefined();
  });

  test('종일이면 시간을 보내지 않는다', () => {
    // Given
    const draft = createDraft(DAILY, { isAllDay: true });

    // When
    const request = toCreateRepeatingTodoRequest(draft);

    // Then
    expect(request.scheduledTime).toBeUndefined();
  });
});

describe('toUpdateTodoRequest', () => {
  test('생략은 유지라 옵션이 없으면 범위·규칙 키를 보내지 않는다', () => {
    // When
    const request = toUpdateTodoRequest({ title: '새 제목' }, {});

    // Then
    expect(request).toEqual({ title: '새 제목' });
  });

  test('null은 반복 끝내기라 repeat 키를 null로 보낸다', () => {
    // When
    const request = toUpdateTodoRequest({}, { repeat: null });

    // Then
    expect(request).toEqual({ repeat: null });
  });

  test('규칙 변경은 범위와 함께 계약 모양으로 보낸다', () => {
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
  test('시간은 PATCH로 보내고 날짜는 보내지 않는다', () => {
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

  test('카테고리도 PATCH로 범위와 함께 보낸다', () => {
    // When
    const request = toFollowingCategoryRequest({ categoryId: 7 });

    // Then
    expect(request).toEqual({ categoryId: 7, scope: 'THIS_AND_FOLLOWING' });
  });
});

describe('toTodoSeries', () => {
  test('규칙 응답에서 앱이 쓰는 값만 옮긴다', () => {
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
