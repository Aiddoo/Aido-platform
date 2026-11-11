import { toDateKey } from '@src/shared/date/zoned';
import dayjs from 'dayjs';

import { clampCalendarPage, getCalendarPageAtOffset } from './calendar-pager.geometry';

const SYSTEM_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

describe('clampCalendarPage', () => {
  it('페이지 범위 밖의 값을 처음과 마지막 페이지로 맞춘다', () => {
    // When
    const below = clampCalendarPage(-3, 10);
    const inside = clampCalendarPage(4, 10);
    const above = clampCalendarPage(12, 10);

    // Then
    expect(below).toBe(0);
    expect(inside).toBe(4);
    expect(above).toBe(9);
  });
});

describe('getCalendarPageAtOffset', () => {
  const TOTAL_PAGES = 521;
  const CENTER_PAGE = 260;

  it('상태 너비가 아직 창 너비여도 네이티브 뷰포트 너비로 한 장 넘긴 페이지를 계산한다', () => {
    // Given
    // Duo 분할 화면 뷰포트 400에서 가운데 다음 페이지로 한 장 넘겼다 (상태 너비는 창 너비 1000)
    const offsetX = (CENTER_PAGE + 1) * 400;

    // When
    const page = getCalendarPageAtOffset({ offsetX, viewportWidth: 400, totalPages: TOTAL_PAGES });

    // Then
    // 창 너비로 나눴다면 104페이지(약 3년 전)로 튀었다
    expect(page).toBe(261);
  });

  it('콘텐츠보다 큰 오프셋은 마지막 페이지로 자르며, 그 주는 260주 뒤 2031-10-20 월요일이다', () => {
    // Given
    // 너비가 줄어든 뒤 이전 오프셋이 남아 콘텐츠 끝을 넘었다
    const offsetX = TOTAL_PAGES * 400 * 3;

    // When
    const page = getCalendarPageAtOffset({ offsetX, viewportWidth: 400, totalPages: TOTAL_PAGES });

    // Then
    // 2026-10-25 주에서 시작한 페이저라면 사용자가 본 2031년 날짜가 선택된다
    expect(page).toBe(TOTAL_PAGES - 1);
    const monday = dayjs(new Date(2026, 9, 25))
      .add(page - CENTER_PAGE, 'week')
      .day(1)
      .toDate();
    expect(toDateKey(monday, SYSTEM_TIME_ZONE)).toBe('2031-10-20');
  });
});
