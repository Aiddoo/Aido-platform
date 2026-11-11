import { sum } from 'es-toolkit';

export type CalendarHeaderLayout = 'inline' | 'stacked';

interface CalendarHeaderWidths {
  availableWidth: number;
  gap: number;
  widestTitleWidth: number;
  todayWidth: number;
  viewModeTabsWidth: number;
  navigationWidth: number;
}

/** 가장 긴 제목·오늘·보기 전환·이동이 간격을 두고 한 줄에 들어가면 한 줄, 아니면 제목 줄과 버튼 줄로 나눈다 */
export function getCalendarHeaderLayout({
  availableWidth,
  gap,
  widestTitleWidth,
  todayWidth,
  viewModeTabsWidth,
  navigationWidth,
}: CalendarHeaderWidths): CalendarHeaderLayout {
  const itemWidths = [widestTitleWidth, todayWidth, viewModeTabsWidth, navigationWidth];
  const inlineWidth = sum(itemWidths) + gap * (itemWidths.length - 1);
  return inlineWidth <= availableWidth ? 'inline' : 'stacked';
}
