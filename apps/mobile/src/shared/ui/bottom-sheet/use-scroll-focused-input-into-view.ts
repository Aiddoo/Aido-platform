import { useCallback, useEffect } from 'react';
import {
  type HostInstance,
  Keyboard,
  type KeyboardEvent,
  Platform,
  type ScrollView,
  TextInput,
} from 'react-native';
import {
  scrollTo,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedRef,
  useSharedValue,
} from 'react-native-reanimated';

import {
  getFocusedInputScrollOffset,
  getLayoutAboveKeyboard,
  type VerticalRect,
} from './get-focused-input-scroll-offset';

// 포커스는 입력 칸 안쪽 TextInput에 있으므로 위로는 라벨, 아래로는 입력 칸 테두리·안쪽 여백까지 함께 보이게 한다
const FOCUSED_INPUT_MARGIN_ABOVE = 40;
const FOCUSED_INPUT_MARGIN_BELOW = 14;

/** 시트가 fromPosition → toPosition으로 가는 동안 스크롤을 fromOffset → toOffset으로 같은 비율만큼 옮긴다 */
interface ScrollPlan {
  fromPosition: number;
  toPosition: number;
  fromOffset: number;
  toOffset: number;
}
// iOS는 키보드가 움직이기 시작할 때(willShow) 알려 주지만, 그때는 아직 입력의 onFocus가 JS에 오지 않았다
const MAX_FOCUS_WAIT_FRAMES = 30;

// iOS는 키보드가 움직이기 시작할 때 맞추고 다 올라온 뒤 확인한다. Android는 다 올라온 뒤에만 알려 주며 gorhom도 그때 시트를 옮긴다.
const KEYBOARD_SHOW_EVENTS =
  Platform.OS === 'ios'
    ? (['keyboardWillShow', 'keyboardDidShow'] as const)
    : (['keyboardDidShow'] as const);
const KEYBOARD_HIDE_EVENT = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

const measureInWindow = (node: Pick<HostInstance, 'measureInWindow'>) =>
  new Promise<VerticalRect>((resolve) => {
    node.measureInWindow((_x, top, _width, height) => resolve({ top, height }));
  });

const waitForFocusedInput = () =>
  new Promise<HostInstance | null>((resolve) => {
    let frames = 0;
    const check = () => {
      const input = TextInput.State.currentlyFocusedInput();
      frames += 1;
      if (input != null || frames >= MAX_FOCUS_WAIT_FRAMES) {
        resolve(input ?? null);
        return;
      }
      requestAnimationFrame(check);
    };
    check();
  });

interface ScrollFocusedInputOptions {
  isOpen: boolean;
  /** gorhom 시트 위치. 키보드를 따라 움직이는 동안 스크롤을 같은 프레임에 맞춘다 */
  animatedPosition: SharedValue<number>;
  /** 키보드가 떠 있을 때 스크롤 영역 아래를 덮는 고정 footer 높이 */
  bottomInset: number;
  /** 키보드가 올라와도 스크롤 영역이 넘지 않는 위쪽 한계(창 좌표, topInset + 손잡이) */
  viewportTopLimit: number;
}

/**
 * 키보드가 올라오면 포커스된 입력이 고정 footer·키보드에 가리지 않게 시트 스크롤 영역을 스크롤한다.
 *
 * gorhom은 시트를 키보드와 함께 올리면서 스크롤 영역을 조금씩 줄인다. 키보드가 다 올라온 뒤 한 번에 스크롤하면
 * "키보드 → 멈춤 → 스크롤" 두 단계가 되므로, 올라오기 시작할 때 다 올라온 뒤의 목표 위치를 미리 구하고
 * 시트가 움직인 비율만큼 UI 스레드에서 스크롤을 옮긴다. 그래서 키보드·시트·스크롤이 한 동작으로 움직인다.
 * 다 올라온 뒤 실제 배치로 한 번 더 재며, 예측이 맞으면 움직이지 않는다.
 */
export function useScrollFocusedInputIntoView({
  isOpen,
  animatedPosition,
  bottomInset,
  viewportTopLimit,
}: ScrollFocusedInputOptions) {
  const scrollViewRef = useAnimatedRef<typeof ScrollView>();
  const scrollPlan = useSharedValue<ScrollPlan | null>(null);

  useAnimatedReaction(
    () => animatedPosition.get(),
    (position, previous) => {
      const plan = scrollPlan.get();
      if (plan == null || position === previous) {
        return;
      }
      const progress = Math.min(
        Math.max((position - plan.fromPosition) / (plan.toPosition - plan.fromPosition), 0),
        1,
      );
      scrollTo(
        scrollViewRef,
        0,
        plan.fromOffset + (plan.toOffset - plan.fromOffset) * progress,
        false,
      );
      if (progress === 1) {
        scrollPlan.set(null);
      }
    },
  );

  const scrollFocusedInputIntoView = useCallback(
    async (keyboardTop: number) => {
      const input = await waitForFocusedInput();
      const scrollView = scrollViewRef.current;
      const content = scrollView?.getInnerViewRef();
      if (scrollView == null || content == null || input == null) {
        return;
      }

      const [viewport, contentRect, inputRect] = await Promise.all([
        measureInWindow(scrollView),
        measureInWindow(content),
        measureInWindow(input),
      ]);
      const layoutAboveKeyboard = getLayoutAboveKeyboard(
        { viewport, content: contentRect, input: inputRect },
        keyboardTop,
        viewportTopLimit,
      );
      const offset = getFocusedInputScrollOffset({
        ...layoutAboveKeyboard,
        bottomInset,
        marginAbove: FOCUSED_INPUT_MARGIN_ABOVE,
        marginBelow: FOCUSED_INPUT_MARGIN_BELOW,
      });
      const sheetShift = layoutAboveKeyboard.viewport.top - viewport.top;
      if (Math.abs(sheetShift) < 1) {
        // 시트가 더 움직이지 않으면(포커스만 옮김, 다 올라온 뒤 확인) 직접 스크롤한다
        scrollPlan.set(null);
        if (offset != null) {
          scrollView.scrollTo({ y: offset, animated: true });
        }
        return;
      }
      if (offset == null) {
        return;
      }
      const position = animatedPosition.get();
      scrollPlan.set({
        fromPosition: position,
        toPosition: position + sheetShift,
        fromOffset: viewport.top - contentRect.top,
        toOffset: offset,
      });
    },
    [animatedPosition, bottomInset, scrollPlan, scrollViewRef, viewportTopLimit],
  );

  const releasePlan = useCallback(() => {
    scrollPlan.set(null);
  }, [scrollPlan]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKeyboardShow = (event: KeyboardEvent) => {
      scrollFocusedInputIntoView(event.endCoordinates.screenY).catch(releasePlan);
    };
    const subscriptions = [
      ...KEYBOARD_SHOW_EVENTS.map((eventName) =>
        Keyboard.addListener(eventName, handleKeyboardShow),
      ),
      Keyboard.addListener(KEYBOARD_HIDE_EVENT, releasePlan),
    ];
    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      releasePlan();
    };
  }, [isOpen, releasePlan, scrollFocusedInputIntoView]);

  // 사용자가 직접 스크롤하기 시작하면 더는 붙잡지 않는다
  return { scrollViewRef, handleScrollBeginDrag: releasePlan };
}
