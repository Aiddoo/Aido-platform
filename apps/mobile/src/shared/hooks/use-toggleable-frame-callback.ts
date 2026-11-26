import { useEffect } from 'react';
import { type FrameInfo, useFrameCallback } from 'react-native-reanimated';

/** useFrameCallback의 두 번째 인자는 첫 렌더 값만 쓰여 켜짐이 바뀌어도 따르지 않아 setActive로 맞춘다 */
export function useToggleableFrameCallback(
  callback: (frame: FrameInfo) => void,
  { isActive }: { isActive: boolean },
) {
  const frameCallback = useFrameCallback(callback, false);

  useEffect(() => {
    frameCallback.setActive(isActive);
    return () => frameCallback.setActive(false);
  }, [frameCallback, isActive]);
}
