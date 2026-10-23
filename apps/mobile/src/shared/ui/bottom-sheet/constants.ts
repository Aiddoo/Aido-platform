import { StyleSheet } from 'react-native';
import { Easing } from 'react-native-reanimated';

/** 닫기 전용 빠른 애니메이션. 열기는 기본 속도 유지. */
export const FAST_DISMISS = { duration: 250, easing: Easing.out(Easing.quad) };

export const SHEET_INDEX = {
  CLOSED: -1,
  OPEN: 0,
} as const;

export const MIN_CONTENT_HEIGHT = 280;
export const TOP_MARGIN = 24;
/** medium 이상 창에서 시트가 화면 전체로 퍼지지 않게 하는 최대 폭(dp). */
export const SHEET_MAX_WIDTH = 560;
export const SHEET_DETACHED_MARGIN = 16;

export const sharedSheetStyles = StyleSheet.create({
  detached: {
    marginHorizontal: SHEET_DETACHED_MARGIN,
  },
  detachedBackground: {
    borderRadius: 32,
  },
  handleIndicator: {
    width: 36,
  },
  content: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
});
