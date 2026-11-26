import { Easing } from 'react-native-reanimated';

export const CHART_LABEL_GAP_PT = 6;

/**
 * 손가락이 이보다 멀리 움직이면 탭을 실패시켜, 차트 위에서 시작한 세로 스크롤이 손을 뗀 자리의 칸을 고르지 않는다.
 * Android 스크롤이 시작되는 거리(ViewConfiguration touch slop 8dp)와 같다
 */
export const CHART_TAP_MAX_DISTANCE_PT = 8;
/** 세로 스크롤과 다투지 않게 가로로 먼저 움직일 때만 밀기로 잡고, 세로로 먼저 움직이면 스크롤에 넘긴다 */
export const CHART_PAN_ACTIVE_OFFSET_X_PT = 8;
export const CHART_PAN_FAIL_OFFSET_Y_PT = 12;

/** 최근 리포트 카드의 주별 완료율 추세에 그리는 주 수 */
export const TREND_WEEK_COUNT = 8;

export const CHART_REVEAL_EASING = Easing.out(Easing.cubic);
