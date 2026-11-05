import { useIsFocused } from 'expo-router';
import { useEffect, useEffectEvent } from 'react';

/** 다른 화면이 위로 올라와 이 화면이 가려질 때 부른다. 화면이 닫힐 때는 부르지 않는다 */
export function useOnScreenBlur(onBlur: () => void) {
  const isFocused = useIsFocused();
  const handleBlur = useEffectEvent(onBlur);

  useEffect(() => {
    if (!isFocused) {
      handleBlur();
    }
  }, [isFocused]);
}
