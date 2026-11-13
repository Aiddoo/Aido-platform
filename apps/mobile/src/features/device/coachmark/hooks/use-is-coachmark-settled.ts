import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

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
}

// 다시 가려지거나 키보드가 움직이거나 `restartKey`가 바뀌면 시트·대상이 움직이므로 처음부터 기다린다
export function useIsCoachmarkSettled({ isVisible, restartKey }: UseIsCoachmarkSettledOptions) {
  const [keyboardMoveCount, setKeyboardMoveCount] = useState(0);
  const [isSettled, setIsSettled] = useState(false);

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
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }
    const timer = setTimeout(() => setIsSettled(true), COACHMARK_SETTLE_MS);

    return () => {
      clearTimeout(timer);
      setIsSettled(false);
    };
  }, [isVisible, keyboardMoveCount, restartKey]);

  return isVisible && isSettled;
}
