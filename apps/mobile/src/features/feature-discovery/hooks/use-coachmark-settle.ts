import { useEffect, useState } from 'react';

/** 화면·시트가 올라오는 동안에는 말풍선이 대상 자리를 잘못 재므로 이만큼 뒤에 연다 */
const COACHMARK_SETTLE_MS = 450;

/** 말풍선이 대상 자리를 재도 되는 때가 됐는지 */
export function useCoachmarkSettle() {
  const [isSettled, setIsSettled] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsSettled(true), COACHMARK_SETTLE_MS);
    return () => clearTimeout(timer);
  }, []);

  return isSettled;
}
