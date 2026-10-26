import { formatDate } from '@src/shared/utils/date';

import { createParseTodoResponseDto } from '../__tests__/parsed-todo.factories';
import { toParsedTodoResult } from './parsed-todo.mapper';

jest.useFakeTimers({ now: new Date('2026-03-08T00:00:00.000Z') });

describe('toParsedTodoResult', () => {
  test('startDate ISO → Date, recurrence null', () => {
    // Given
    const dto = createParseTodoResponseDto();

    // When
    const result = toParsedTodoResult(dto);

    // Then
    expect(result.data.startDate).toBeInstanceOf(Date);
    expect(result.data.recurrence).toBeNull();
    expect(result.data.categoryId).toBe(1);
    expect(result.meta.model).toBe('gpt-4');
  });

  test('recurrence 있는 경우 endDate → Date 변환', () => {
    // Given
    const dto = createParseTodoResponseDto({
      data: {
        ...createParseTodoResponseDto().data,
        isRecurring: true,
        recurrence: {
          daysOfWeek: ['MON', 'WED', 'FRI'],
          endDate: '2026-06-30',
        },
      },
    });

    // When
    const result = toParsedTodoResult(dto);

    // Then
    expect(result.data.recurrence).not.toBeNull();
    expect(result.data.recurrence?.endDate).toBeInstanceOf(Date);
    expect(result.data.recurrence?.daysOfWeek).toEqual(['MON', 'WED', 'FRI']);
  });

  test('categoryId 없는 경우 제외', () => {
    // Given
    const dto = createParseTodoResponseDto({
      data: {
        ...createParseTodoResponseDto().data,
        categoryId: undefined,
      },
    });

    // When
    const result = toParsedTodoResult(dto);

    // Then
    expect(result.data).not.toHaveProperty('categoryId');
  });

  test('서버 날짜를 기기 로컬 날짜로 읽어 시간대와 무관하게 같은 날짜를 유지한다', () => {
    // Given - UTC 자정으로 읽으면 UTC 음수 시간대에서 하루 앞당겨지는 날짜들
    const dto = createParseTodoResponseDto({
      data: {
        ...createParseTodoResponseDto().data,
        startDate: '2026-10-29',
        endDate: '2026-10-31',
        isRecurring: true,
        recurrence: { daysOfWeek: ['THU'], endDate: '2026-11-26' },
      },
    });

    // When
    const result = toParsedTodoResult(dto);

    // Then - 로컬 달력 날짜가 서버 문자열과 같다
    expect(formatDate(result.data.startDate)).toBe('2026-10-29');
    expect(result.data.endDate == null ? null : formatDate(result.data.endDate)).toBe('2026-10-31');
    expect(result.data.recurrence == null ? null : formatDate(result.data.recurrence.endDate)).toBe(
      '2026-11-26',
    );
    expect(result.data.startDate.getHours()).toBe(0);
  });

  test.each([
    { name: '윤일', startDate: '2028-02-29', endDate: '2028-03-01', until: '2028-03-28' },
    { name: '평년 2월 말', startDate: '2027-02-28', endDate: '2027-03-01', until: '2027-03-28' },
    {
      name: '53주차(12-28~01-03)',
      startDate: '2026-12-28',
      endDate: '2027-01-03',
      until: '2027-01-29',
    },
    { name: '연말·연초', startDate: '2026-12-31', endDate: '2027-01-01', until: '2027-01-28' },
    {
      name: 'LA 봄 서머타임 전환일',
      startDate: '2028-03-12',
      endDate: '2028-03-13',
      until: '2028-04-09',
    },
    {
      name: 'LA 가을 서머타임 전환일',
      startDate: '2028-11-05',
      endDate: '2028-11-06',
      until: '2028-12-03',
    },
  ])(
    '$name 날짜 문자열은 어느 기기 시간대에서도 같은 로컬 달력 날짜와 자정으로 읽힌다',
    ({ startDate, endDate, until }) => {
      // Given
      const dto = createParseTodoResponseDto({
        data: {
          ...createParseTodoResponseDto().data,
          startDate,
          endDate,
          isRecurring: true,
          recurrence: { daysOfWeek: ['MON'], endDate: until },
        },
      });

      // When
      const { data } = toParsedTodoResult(dto);

      // Then
      expect(formatDate(data.startDate)).toBe(startDate);
      expect(data.endDate == null ? null : formatDate(data.endDate)).toBe(endDate);
      expect(data.recurrence == null ? null : formatDate(data.recurrence.endDate)).toBe(until);
      expect([data.startDate.getHours(), data.startDate.getMinutes()]).toEqual([0, 0]);
    },
  );
});
