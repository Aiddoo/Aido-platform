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

export const sharedSheetStyles = StyleSheet.create({
  detached: {
    marginHorizontal: 16,
  },
  detachedBackground: {
    borderRadius: 24,
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
