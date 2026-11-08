import { useCallback, useLayoutEffect, useRef } from 'react';

/** 손가락이 두 번 튀는 시간. 이 안에 들어온 반복 탭은 같은 한 번으로 본다. */
const TAP_GUARD_MS = 600;

/** 연타로 같은 화면이 스택에 두 번 쌓이는 것을 막는다. 가드는 훅 인스턴스마다 따로 산다 */
export function useSingleTap<Args extends unknown[]>(
  onTap: (...args: Args) => void,
): (...args: Args) => void {
  // 항상 최신 핸들러를 부르되 반환 함수의 정체성은 고정한다 (memo된 자식이 다시 그려지지 않도록).
  const onTapRef = useRef(onTap);

  useLayoutEffect(() => {
    onTapRef.current = onTap;
  });

  const lastTappedAtRef = useRef(0);

  return useCallback((...args: Args) => {
    const now = Date.now();

    if (now - lastTappedAtRef.current < TAP_GUARD_MS) {
      return;
    }

    lastTappedAtRef.current = now;

    onTapRef.current(...args);
  }, []);
}
