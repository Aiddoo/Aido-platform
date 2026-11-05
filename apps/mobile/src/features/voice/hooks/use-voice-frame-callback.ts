import { useEffect } from 'react';
import { type FrameInfo, useFrameCallback } from 'react-native-reanimated';

/**
 * 켜고 끌 수 있는 프레임 콜백. `useFrameCallback`의 두 번째 인자는 첫 렌더 값만 쓰여서,
 * 준비 중(false)에 마운트해 듣기(true)로 바뀌어도 시작하지 않고 그 반대도 멈추지 않는다. 그래서 `setActive`로 맞춘다.
 */
export function useVoiceFrameCallback(callback: (frame: FrameInfo) => void, isActive: boolean) {
  const frameCallback = useFrameCallback(callback, false);

  useEffect(() => {
    frameCallback.setActive(isActive);
  }, [frameCallback, isActive]);
}
