import { SHEET_MAX_WIDTH } from './constants';

/** 시트를 최대 폭으로 제한하고 가운데 정렬하는 좌우 여백. 최대 폭보다 좁은 창에서는 `minMargin`만 둔다. */
export function getSheetHorizontalMargin(windowWidth: number, minMargin: number): number {
  return Math.max(minMargin, (windowWidth - SHEET_MAX_WIDTH) / 2);
}
