import { findVerticalFold } from '@src/shared/utils/find-vertical-fold';
import type { ReservedRegion } from 'react-native-reserved-regions';

import { MIN_CONTENT_HEIGHT, TOP_MARGIN } from './constants';
import {
  getSheetHorizontalMargins,
  type SheetHorizontalMargins,
} from './get-sheet-horizontal-margins';

export interface SheetLayout {
  margins: SheetHorizontalMargins;
  topInset: number;
}

export interface SheetLayoutInput {
  windowWidth: number;
  safeAreaInsets: SheetHorizontalMargins & { top: number };
  minMargin: number;
  isFullWindowHost: boolean;
  reservedRegions: readonly ReservedRegion[];
}

const NO_SAFE_AREA: SheetHorizontalMargins = { left: 0, right: 0 };

/**
 * 시트의 좌우 여백과 위쪽 한계.
 * - 화면 안 시트: 탭 레일이 시트 위에 남으므로 가로 safe area를 피한다.
 * - 전체 창 호스트(route 시트·overlay)의 시트: 레일을 덮으므로 좌우 대칭으로 채우고, 반쯤 접힌 접힘선은 넘지 않으며,
 *   상태 표시 같은 occlusion 아래에서 시작한다.
 */
export function getSheetLayout({
  windowWidth,
  safeAreaInsets,
  minMargin,
  isFullWindowHost,
  reservedRegions,
}: SheetLayoutInput): SheetLayout {
  if (!isFullWindowHost) {
    return {
      margins: getSheetHorizontalMargins(windowWidth, safeAreaInsets, minMargin),
      topInset: safeAreaInsets.top,
    };
  }

  const span = getSheetSpan(windowWidth, reservedRegions);
  const spanMargins = getSheetHorizontalMargins(span.end - span.start, NO_SAFE_AREA, minMargin);
  const margins = {
    left: span.start + spanMargins.left,
    right: windowWidth - span.end + spanMargins.right,
  };
  const occlusionBottoms = reservedRegions
    .filter((region) => region.kind === 'occlusion')
    .filter(
      ({ frame }) => frame.x < windowWidth - margins.right && frame.x + frame.width > margins.left,
    )
    .map(({ frame }) => frame.y + frame.height);

  return { margins, topInset: Math.max(safeAreaInsets.top, ...occlusionBottoms) };
}

/** 세로 접힘선이 있으면 더 넓은 쪽, 같으면 뒤쪽 면에 시트를 둔다. */
function getSheetSpan(windowWidth: number, reservedRegions: readonly ReservedRegion[]) {
  const fold = findVerticalFold(reservedRegions);

  if (fold == null) {
    return { start: 0, end: windowWidth };
  }

  const leadingEnd = fold.frame.x;
  const trailingStart = fold.frame.x + fold.frame.width;

  return leadingEnd > windowWidth - trailingStart
    ? { start: 0, end: leadingEnd }
    : { start: trailingStart, end: windowWidth };
}

/** 위쪽 한계와 아래 여백 사이에 들어가는 시트 최대 높이. 내용이 더 길면 시트 안에서 스크롤한다. */
export function getSheetMaxHeight(windowHeight: number, topInset: number, bottomInset: number) {
  return Math.max(MIN_CONTENT_HEIGHT, windowHeight - topInset - TOP_MARGIN - bottomInset);
}
