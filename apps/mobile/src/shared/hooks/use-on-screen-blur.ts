import { useIsFocused } from 'expo-router';
import { useEffect, useEffectEvent } from 'react';

/** 화면이 닫힐 때는 부르지 않는다 */
export function useOnScreenBlur(onBlur: () => void) {
  const isFocused = useIsFocused();
  const handleBlur = useEffectEvent(onBlur);

  useEffect(() => {
    if (!isFocused) {
      handleBlur();
    }
  }, [isFocused]);
}
