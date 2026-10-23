import { useCallback, useLayoutEffect, useRef } from 'react';

/** 손가락이 두 번 튀는 시간. 이 안에 들어온 반복 탭은 같은 한 번으로 본다. */
const TAP_GUARD_MS = 600;

/**
 * 두 번 실행되면 곤란한 동작(화면 이동 등)을 첫 탭만 통과시킨다.
 * 연타로 같은 화면이 스택에 두 번 쌓이는 것을 막는다.
 *
 * 타이머도 구독도 만들지 않는다 — 마지막 실행 시각만 비교하므로
 * 언마운트 뒤에 살아남아 실행될 일이 없고, 프레임에 예약되는 작업도 없다.
 *
 * 가드는 훅 인스턴스마다 따로 산다. 그래서 서로 다른 두 동작(예: 닫기 → 이동)을
 * 연달아 부르는 흐름은 막히지 않고, 같은 버튼의 연타만 걸러진다.
 *
 * @example
 * const push = useSingleTap(router.push);
 * <Button onPress={() => push('/settings/profile')} />
 */
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
