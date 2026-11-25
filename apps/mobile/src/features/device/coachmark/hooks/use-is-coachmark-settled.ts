import { useAppWindow } from '@src/shared/hooks/use-app-window';
import { type ComponentRef, type RefObject, useEffect, useEffectEvent, useState } from 'react';
import { Keyboard, type View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** 화면·시트·키보드가 움직이거나 탭이 바뀌는 동안에는 말풍선이 대상 자리를 잘못 재므로 이만큼 뒤에 연다 */
const COACHMARK_SETTLE_MS = 450;
/** Android는 Did만 온다. 키보드 시트는 keyboard-controller를 꺼 두므로 그 이벤트 대신 RN 이벤트를 듣는다 */
const KEYBOARD_MOVE_EVENTS = [
  'keyboardWillShow',
  'keyboardDidShow',
  'keyboardWillHide',
  'keyboardDidHide',
] as const;

interface UseIsCoachmarkSettledOptions {
  isVisible: boolean;
  /** 바뀌면(달력 넘기기) 대상이 움직였으므로 처음부터 기다린다 */
  restartKey?: string;
  /** 스크롤 안이라 화면 밖에 있을 수 있는 대상. 넘기면 기다린 뒤 안전 영역 안에 다 보일 때만 자리를 잡은 것으로 본다 */
  onScreenTargetRef?: RefObject<ComponentRef<typeof View> | null>;
}

// 다시 가려지거나 키보드가 움직이거나 `restartKey`가 바뀌면 시트·대상이 움직이므로 처음부터 기다린다
export function useIsCoachmarkSettled({
  isVisible,
  restartKey,
  onScreenTargetRef,
}: UseIsCoachmarkSettledOptions) {
  const [keyboardMoveCount, setKeyboardMoveCount] = useState(0);
  const [isSettled, setIsSettled] = useState(false);
  const { height: windowHeight } = useAppWindow();
  // 탭 화면의 아래 안전 영역에는 떠 있는 탭 막대가 들어 있어 막대에 가린 대상도 화면 밖으로 본다
  const safeAreaInsets = useSafeAreaInsets();

  // 가려진 동안의 키보드 움직임은 다시 보일 때 처음부터 기다리므로 셀 필요가 없다. 보이는 동안만 듣는다
  useEffect(() => {
    if (!isVisible) {
      return;
    }
    const subscriptions = KEYBOARD_MOVE_EVENTS.map((event) =>
      // oxlint-disable-next-line no-restricted-properties -- 위치를 흉내 내지 않고 키보드가 움직인 횟수만 세어 말풍선 열기를 미룬다
      Keyboard.addListener(event, () => setKeyboardMoveCount((count) => count + 1)),
    );

    return () => {
      for (const subscription of subscriptions) {
        subscription.remove();
      }
    };
  }, [isVisible]);

  const settle = useEffectEvent((isCurrent: () => boolean) => {
    if (onScreenTargetRef == null) {
      setIsSettled(true);
      return;
    }
    onScreenTargetRef.current?.measureInWindow((_x, top, _width, height) => {
      if (isCurrent()) {
        setIsSettled(
          safeAreaInsets.top <= top && top + height <= windowHeight - safeAreaInsets.bottom,
        );
      }
    });
  });

  useEffect(() => {
    if (!isVisible) {
      return;
    }
    let isCurrent = true;
    const timer = setTimeout(() => settle(() => isCurrent), COACHMARK_SETTLE_MS);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
      setIsSettled(false);
    };
  }, [isVisible, keyboardMoveCount, restartKey]);

  return isVisible && isSettled;
}
