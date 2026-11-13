import { StyleSheet } from 'react-native';

/** gorhom 기본값은 iOS만 스프링이라 닫힘 콜백이 680ms 뒤에 와 route 시트의 투명 모달이 탭을 막았다. Android 기본값(250ms)과 맞춘다 */
export const SHEET_ANIMATION_DURATION_MS = 250;

export const SHEET_INDEX = {
  CLOSED: -1,
  OPEN: 0,
} as const;

export const MIN_CONTENT_HEIGHT = 280;
export const TOP_MARGIN = 24;
/** gorhom 기본 손잡이 영역 높이. */
export const HANDLE_HEIGHT = 24;
/** medium 이상 창에서 시트가 화면 전체로 퍼지지 않게 하는 최대 폭(dp). */
export const SHEET_MAX_WIDTH = 560;
export const SHEET_DETACHED_MARGIN = 16;
export const SHEET_RADIUS = 32;
export const SHEET_CONTENT_PADDING = 20;
export const SHEET_FOOTER_PADDING_TOP = 12;
export const SHEET_OVERLAY_OPACITY = 0.5;

export const SHARED_SHEET_STYLES = StyleSheet.create({
  detached: {
    marginHorizontal: SHEET_DETACHED_MARGIN,
  },
  detachedBackground: {
    borderRadius: SHEET_RADIUS,
  },
  handleIndicator: {
    width: 36,
  },
  content: {
    paddingTop: 20,
    paddingHorizontal: SHEET_CONTENT_PADDING,
    paddingBottom: 20,
  },
});
