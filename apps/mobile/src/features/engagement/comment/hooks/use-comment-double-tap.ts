import { useHaptics } from '@src/bootstrap/providers/di-context';
import { useIsReduceMotionEnabled } from '@src/shared/hooks/use-is-reduce-motion-enabled';
import {
  useExclusiveGestures,
  useLongPressGesture,
  useTapGesture,
} from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  playTodoCommentHeartBurst,
  popTodoCommentLikeButton,
  type TodoCommentHeartBurstValues,
} from '../components/todo-comment-heart-burst';

const DOUBLE_TAP_MAX_DELAY_MS = 300;
const LONG_PRESS_MIN_DURATION_MS = 450;

interface CommentDoubleTapOptions {
  burst: TodoCommentHeartBurstValues;
  likeButtonScale: SharedValue<number>;
  canLike: boolean;
  onDoubleTap: () => void;
  onLongPress: () => void;
}

/**
 * 본문 두 번 탭은 하트, 길게 누르기는 메뉴다. 둘은 서로 배타적이고 한 번 탭은 아무 동작도 하지 않는다.
 * 애니메이션은 shared value로 UI 스레드에서만 돌고, 좋아요 요청과 진동만 JS로 넘긴다.
 */
export function useCommentDoubleTap({
  burst,
  likeButtonScale,
  canLike,
  onDoubleTap,
  onLongPress,
}: CommentDoubleTapOptions) {
  const haptics = useHaptics();
  const isReducedMotion = useIsReduceMotionEnabled();
  const lightImpact = () => haptics.impact('light');

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    maxDelay: DOUBLE_TAP_MAX_DELAY_MS,
    enabled: canLike,
    onActivate: (event) => {
      'worklet';
      playTodoCommentHeartBurst(burst, { x: event.x, y: event.y, isReducedMotion });
      if (!isReducedMotion) {
        popTodoCommentLikeButton(likeButtonScale);
      }
      scheduleOnRN(lightImpact);
      scheduleOnRN(onDoubleTap);
    },
  });
  const longPress = useLongPressGesture({
    minDuration: LONG_PRESS_MIN_DURATION_MS,
    onActivate: () => {
      'worklet';
      scheduleOnRN(onLongPress);
    },
  });

  return useExclusiveGestures(doubleTap, longPress);
}
