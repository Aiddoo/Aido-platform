import { SHEET_MAX_WIDTH } from './constants';

export interface SheetHorizontalMargins {
  left: number;
  right: number;
}

/**
 * 가로 safe area(iPhone Duo 세로 레일 등)를 뺀 콘텐츠 영역에서 시트를 최대 폭으로 제한하고 가운데 정렬하는 좌우 여백.
 * 콘텐츠 영역이 최대 폭보다 좁으면 safe area 바깥에 `minMargin`만 둔다.
 */
export function getSheetHorizontalMargins(
  windowWidth: number,
  safeAreaInsets: SheetHorizontalMargins,
  minMargin: number,
): SheetHorizontalMargins {
  const contentWidth = windowWidth - safeAreaInsets.left - safeAreaInsets.right;
  const sideMargin = Math.max(minMargin, (contentWidth - SHEET_MAX_WIDTH) / 2);

  return { left: safeAreaInsets.left + sideMargin, right: safeAreaInsets.right + sideMargin };
}
