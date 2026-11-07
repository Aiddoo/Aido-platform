import { clamp } from 'es-toolkit';

export function clampCalendarPage(page: number, totalPages: number): number {
  return clamp(page, 0, totalPages - 1);
}

interface CalendarPageAtOffsetParams {
  offsetX: number;
  viewportWidth: number;
  totalPages: number;
}

/** 스크롤이 멈춘 오프셋의 페이지. 너비는 상태값이 아닌 네이티브가 보고한 뷰포트 너비를 쓴다. */
export function getCalendarPageAtOffset({
  offsetX,
  viewportWidth,
  totalPages,
}: CalendarPageAtOffsetParams): number {
  return clampCalendarPage(Math.round(offsetX / viewportWidth), totalPages);
}
