import { clamp } from 'react-native-reanimated';

export type ScrollProgressState = 'hidden' | 'scrolling' | 'end';

/**
 * 원래 RN 배치와 같은 값이다. 막대는 바깥 면 안쪽 4(margin)에 좌우 padding 10이고,
 * 트랙은 막대 안쪽 폭(padding 뺀 폭)의 60%다(Yoga는 % 폭을 부모의 안쪽 폭으로 잰다)
 */
const BAR_INSET = 4;
const BAR_PADDING_X = 10;
const TRACK_WIDTH_RATIO = 0.6;
/** 스크린 리더에 알리는 퍼센트 간격. 내리는 동안 JS로 넘기는 횟수를 한 번 끝까지 내릴 때 21번 이하로 둔다 */
const PERCENT_REPORT_STEP = 5;

/** 스크롤할 수 있는 거리 중 지나온 비율(0~1). 내용이 화면보다 짧으면 0이다 */
export function getScrollProgress({
  contentOffset,
  contentSize,
  layoutMeasurement,
}: {
  contentOffset: { y: number };
  contentSize: { height: number };
  layoutMeasurement: { height: number };
}) {
  'worklet';
  const scrollable = contentSize.height - layoutMeasurement.height;

  return scrollable > 0 ? clamp(contentOffset.y / scrollable, 0, 1) : 0;
}

/** 맨 위는 숨김, 내리는 중은 퍼센트 막대, 맨 끝은 맨 위로 버튼이다 */
export function getScrollProgressState(progress: number): ScrollProgressState {
  'worklet';
  if (progress <= 0) {
    return 'hidden';
  }
  return progress < 1 ? 'scrolling' : 'end';
}

/** 퍼센트 글자 표의 칸(0~100). 프레임마다 문자열을 만들지 않고 미리 만든 글자를 고른다 */
export function getPercentIndex(progress: number) {
  'worklet';
  return Math.round(clamp(progress, 0, 1) * 100);
}

/** 스크린 리더 값은 5% 간격과 처음·끝에서만 바꾼다. 프레임마다 JS로 넘기지 않는다 */
export function shouldReportPercent(percent: number, reportedPercent: number) {
  'worklet';
  if (percent === reportedPercent) {
    return false;
  }
  return (
    percent === 0 || percent === 100 || Math.abs(percent - reportedPercent) >= PERCENT_REPORT_STEP
  );
}

/** 바깥 면 폭에 따른 트랙 폭. 프레임마다 객체를 만들지 않게 숫자만 돌려준다 */
export function getTrackWidth(pillWidth: number) {
  'worklet';
  return (pillWidth - BAR_INSET * 2 - BAR_PADDING_X * 2) * TRACK_WIDTH_RATIO;
}

/** 글자 칸과 트랙을 한 줄로 이어 면 가운데 둘 때 줄의 왼쪽 끝 */
export function getProgressRowStart(
  pillWidth: number,
  canvasWidth: number,
  percentSlotWidth: number,
) {
  'worklet';
  return (canvasWidth - percentSlotWidth - getTrackWidth(pillWidth)) / 2;
}
