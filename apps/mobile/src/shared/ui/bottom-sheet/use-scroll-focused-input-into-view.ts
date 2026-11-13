import { useCallback, useEffect, useEffectEvent, useRef } from 'react';
import {
  type HostInstance,
  Keyboard,
  type KeyboardEvent,
  type ScrollView,
  TextInput,
} from 'react-native';
import {
  clamp,
  scrollTo,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedRef,
  useSharedValue,
} from 'react-native-reanimated';

import type { FocusedFieldNode } from '../input/focused-field';
import {
  getFocusedInputScrollOffset,
  getLayoutAboveKeyboard,
  type VerticalRect,
} from './get-focused-input-scroll-offset';

// 칸 전체를 알리지 않는 입력은 안쪽 TextInput만 잴 수 있으므로 위로는 라벨, 아래로는 입력 칸 테두리·안쪽 여백까지 함께 보이게 한다
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
  process.env.EXPO_OS === 'ios'
    ? (['keyboardWillShow', 'keyboardDidShow'] as const)
    : (['keyboardDidShow'] as const);
const KEYBOARD_HIDE_EVENT = process.env.EXPO_OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

function measureInWindow(node: Pick<HostInstance, 'measureInWindow'>) {
  return new Promise<VerticalRect>((resolve) => {
    node.measureInWindow((_x, top, _width, height) => resolve({ top, height }));
  });
}

// 시트가 닫히면(effect 정리) 남은 프레임을 취소하고 null로 끝낸다
function waitForFocusedInput(signal: AbortSignal) {
  return new Promise<HostInstance | null>((resolve) => {
    let frames = 0;
    let frameId: number | null = null;
    const stop = () => {
      if (frameId != null) {
        cancelAnimationFrame(frameId);
      }
      resolve(null);
    };
    const check = () => {
      frameId = null;
      const input = TextInput.State.currentlyFocusedInput();
      frames += 1;
      if (input != null || frames >= MAX_FOCUS_WAIT_FRAMES) {
        signal.removeEventListener('abort', stop);
        resolve(input ?? null);
        return;
      }
      frameId = requestAnimationFrame(check);
    };
    if (signal.aborted) {
      resolve(null);
      return;
    }
    signal.addEventListener('abort', stop);
    check();
  });
}

interface ScrollFocusedInputOptions {
  isOpen: boolean;
  /** gorhom 시트 위치. 키보드를 따라 움직이는 동안 스크롤을 같은 프레임에 맞춘다 */
  animatedPosition: SharedValue<number>;
  /** 키보드가 떠 있을 때 스크롤 영역 아래를 덮는 고정 footer 높이 */
  bottomInset: number;
  /** 키보드가 올라와도 스크롤 영역이 넘지 않는 위쪽 한계(창 좌표, topInset + 손잡이) */
  viewportTopLimit: number;
}

/** 키보드가 다 올라온 뒤 한 번에 스크롤하면 "키보드 → 멈춤 → 스크롤" 두 단계가 되므로, 올라오기 시작할 때 목표 위치를 미리 구해 시트가 움직인 비율만큼 UI 스레드에서 옮긴다. 다 올라온 뒤 실제 배치로 한 번 더 재며 예측이 맞으면 움직이지 않는다 */
export function useScrollFocusedInputIntoView({
  isOpen,
  animatedPosition,
  bottomInset,
  viewportTopLimit,
}: ScrollFocusedInputOptions) {
  const scrollViewRef = useAnimatedRef<typeof ScrollView>();
  const scrollPlan = useSharedValue<ScrollPlan | null>(null);
  const keyboardTopRef = useRef<number | null>(null);
  const focusedFieldRef = useRef<FocusedFieldNode | null>(null);

  const reportFocusedField = useCallback((node: FocusedFieldNode, isFocused: boolean) => {
    if (isFocused) {
      focusedFieldRef.current = node;
    } else if (focusedFieldRef.current === node) {
      focusedFieldRef.current = null;
    }
  }, []);

  useAnimatedReaction(
    () => animatedPosition.get(),
    (position, previous) => {
      const plan = scrollPlan.get();
      if (plan == null || position === previous) {
        return;
      }
      const progress = clamp(
        (position - plan.fromPosition) / (plan.toPosition - plan.fromPosition),
        0,
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

  const releasePlan = useCallback(() => {
    scrollPlan.set(null);
  }, [scrollPlan]);

  // 키보드 구독을 bottomInset이 바뀔 때마다 다시 만들면 정리가 떠 있는 키보드 위치를 지워 아래 다시 맞추기가 돌지 않는다
  const scrollFocusedInputIntoView = useEffectEvent(
    async (keyboardTop: number, signal: AbortSignal) => {
      const input = await waitForFocusedInput(signal);
      const scrollView = scrollViewRef.current;
      const content = scrollView?.getInnerViewRef();
      if (signal.aborted || scrollView == null || content == null || input == null) {
        return;
      }

      const field = focusedFieldRef.current;
      const [viewport, contentRect, inputRect] = await Promise.all([
        measureInWindow(scrollView),
        measureInWindow(content),
        measureInWindow(field ?? input),
      ]);
      if (signal.aborted) {
        return;
      }
      const layoutAboveKeyboard = getLayoutAboveKeyboard(
        { viewport, content: contentRect, input: inputRect },
        keyboardTop,
        viewportTopLimit,
      );
      const offset = getFocusedInputScrollOffset({
        ...layoutAboveKeyboard,
        bottomInset,
        marginAbove: field == null ? FOCUSED_INPUT_MARGIN_ABOVE : 0,
        marginBelow: field == null ? FOCUSED_INPUT_MARGIN_BELOW : 0,
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
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const pending = new AbortController();
    const handleKeyboardShow = (event: KeyboardEvent) => {
      keyboardTopRef.current = event.endCoordinates.screenY;
      scrollFocusedInputIntoView(event.endCoordinates.screenY, pending.signal).catch(releasePlan);
    };
    const handleKeyboardHide = () => {
      keyboardTopRef.current = null;
      releasePlan();
    };
    const subscriptions = [
      ...KEYBOARD_SHOW_EVENTS.map((eventName) =>
        Keyboard.addListener(eventName, handleKeyboardShow),
      ),
      Keyboard.addListener(KEYBOARD_HIDE_EVENT, handleKeyboardHide),
    ];
    return () => {
      pending.abort();
      subscriptions.forEach((subscription) => subscription.remove());
      keyboardTopRef.current = null;
      releasePlan();
    };
  }, [isOpen, releasePlan]);

  // 고정 영역 높이는 키보드가 올라온 뒤에 재어질 수 있으므로, 바뀌면 떠 있는 키보드 기준으로 다시 맞춘다(KeyboardAwareScrollView가 bottomOffset 변경에 하듯)
  useEffect(() => {
    const keyboardTop = keyboardTopRef.current;
    if (keyboardTop == null) {
      return;
    }
    const pending = new AbortController();
    scrollFocusedInputIntoView(keyboardTop, pending.signal).catch(releasePlan);
    return () => pending.abort();
  }, [bottomInset, releasePlan]);

  // 사용자가 직접 스크롤하기 시작하면 더는 붙잡지 않는다
  return { scrollViewRef, handleScrollBeginDrag: releasePlan, reportFocusedField };
}
