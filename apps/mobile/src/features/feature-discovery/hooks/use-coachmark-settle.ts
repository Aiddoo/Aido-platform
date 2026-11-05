import { useEffect, useState } from 'react';

/** 화면·시트가 올라오거나 탭이 바뀌는 동안에는 말풍선이 대상 자리를 잘못 재므로 이만큼 뒤에 연다 */
const COACHMARK_SETTLE_MS = 450;

/** `isVisible`이 된 뒤 말풍선이 대상 자리를 재도 되는 때가 됐는지. 다시 가려지면 처음부터 기다린다 */
export function useCoachmarkSettle(isVisible: boolean) {
  const [isSettled, setIsSettled] = useState(false);

  useEffect(() => {
    if (!isVisible) {
      return;
    }
    const timer = setTimeout(() => setIsSettled(true), COACHMARK_SETTLE_MS);

    return () => {
      clearTimeout(timer);
      setIsSettled(false);
    };
  }, [isVisible]);

  return isVisible && isSettled;
}
