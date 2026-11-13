import { clamp } from 'es-toolkit';

// 네이티브가 잰 뷰포트 폭과 쪽 폭의 소수점 반올림 차이만 같은 폭으로 본다
const PAGE_WIDTH_TOLERANCE_PT = 1;

export function clampCalendarPage(page: number, totalPages: number): number {
  return clamp(page, 0, totalPages - 1);
}

interface CalendarPageAtOffsetInput {
  offsetX: number;
  viewportWidth: number;
  pageWidth: number;
  totalPages: number;
}

/**
 * 스크롤이 멈춘 쪽. 창 폭이 바뀌어 목록을 새 폭으로 다시 만들기 전에는 옛 폭의 쪽이 새 뷰포트 안에 남아 쪽 경계가 맞지 않으므로 null이다
 */
export function findCalendarPageAtOffset({
  offsetX,
  viewportWidth,
  pageWidth,
  totalPages,
}: CalendarPageAtOffsetInput): number | null {
  if (Math.abs(viewportWidth - pageWidth) > PAGE_WIDTH_TOLERANCE_PT) {
    return null;
  }
  return clampCalendarPage(Math.round(offsetX / pageWidth), totalPages);
}
