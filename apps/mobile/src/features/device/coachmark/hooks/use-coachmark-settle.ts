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

/**
 * `isVisible`이 된 뒤 말풍선이 대상 자리를 재도 되는 때가 됐는지.
 * 다시 가려지거나 키보드가 움직이면 시트가 함께 움직이므로 처음부터 기다린다. 다시 열 때 자리를 새로 잰다.
 * `restartKey`가 바뀌어도(달력 넘기기처럼 대상이 옮겨 갈 때) 처음부터 기다려, 멈춘 뒤에야 연다.
 */
export function useCoachmarkSettle(isVisible: boolean, restartKey?: string) {
  const [keyboardMoveCount, setKeyboardMoveCount] = useState(0);
  const [isSettled, setIsSettled] = useState(false);

  useEffect(() => {
    const subscriptions = KEYBOARD_MOVE_EVENTS.map((event) =>
      Keyboard.addListener(event, () => setKeyboardMoveCount((count) => count + 1)),
    );

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, []);

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
