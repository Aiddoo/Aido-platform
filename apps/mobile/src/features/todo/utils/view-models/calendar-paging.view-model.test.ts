import { clampCalendarPage, shiftCalendarDate } from './calendar-paging.view-model';

describe('shiftCalendarDate', () => {
  test('주 보기는 선택한 날짜가 속한 주의 시작에서 한 주 이동한다', () => {
    const wednesday = new Date(2026, 9, 14);

    expect(shiftCalendarDate('week', wednesday, 1)).toEqual(new Date(2026, 9, 18));
    expect(shiftCalendarDate('week', wednesday, -1)).toEqual(new Date(2026, 9, 4));
  });

  test('월 보기는 선택한 날짜가 속한 달의 1일에서 한 달 이동한다', () => {
    const middleOfMonth = new Date(2026, 9, 14);

    expect(shiftCalendarDate('month', middleOfMonth, 1)).toEqual(new Date(2026, 10, 1));
    expect(shiftCalendarDate('month', middleOfMonth, -1)).toEqual(new Date(2026, 8, 1));
  });
});

describe('clampCalendarPage', () => {
  test('페이지 범위 밖의 값을 처음과 마지막 페이지로 맞춘다', () => {
    expect(clampCalendarPage(-3, 10)).toBe(0);
    expect(clampCalendarPage(4, 10)).toBe(4);
    expect(clampCalendarPage(12, 10)).toBe(9);
  });
});
