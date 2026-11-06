import { useMemo } from 'react';
import { Directions, Gesture } from 'react-native-gesture-handler';

/** 왼쪽 끝은 iOS 스와이프 뒤로 가기 자리라 밀어 넘기기에서 뺀다 */
const SCREEN_EDGE_INSET = 24;

interface StepFlingInput {
  onNext: () => void;
  onBack: () => void;
}

/** 페이저 없이 현재 단계만 그리고, 옆으로 밀면 단계를 넘긴다. 움직이는 동안 React는 다시 그려지지 않는다 */
export function useStepFling({ onNext, onBack }: StepFlingInput) {
  return useMemo(
    () =>
      Gesture.Race(
        Gesture.Fling().direction(Directions.LEFT).runOnJS(true).onEnd(onNext),
        Gesture.Fling()
          .direction(Directions.RIGHT)
          .hitSlop({ left: -SCREEN_EDGE_INSET })
          .runOnJS(true)
          .onEnd(onBack),
      ),
    [onNext, onBack],
  );
}
