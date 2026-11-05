import { StyleSheet } from 'react-native';
import { Easing } from 'react-native-reanimated';

/** 닫기 전용 빠른 애니메이션. 열기는 기본 속도 유지. */
export const FAST_DISMISS = { duration: 250, easing: Easing.out(Easing.quad) };

/**
 * gorhom 기본값은 iOS만 스프링이라 닫힘 콜백이 680ms 뒤에 와서, 그동안 route 시트의 투명 모달이 탭을 막았다.
 * Android 기본값(250ms)과 맞춘다.
 */
export const SHEET_ANIMATION_DURATION = 250;

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
/** 시트 모서리 반지름. 시트 테두리에 맞물려 그리는 장식도 이 값을 쓴다 */
export const SHEET_RADIUS = 32;
/** 시트 내용의 좌우 여백. 가로 스크롤 줄은 이만큼 밖으로 넓혀 끝이 잘려 보이게 한다 */
export const SHEET_CONTENT_PADDING = 20;

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
