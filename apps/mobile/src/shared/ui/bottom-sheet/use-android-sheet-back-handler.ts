import { useEffect, useEffectEvent } from 'react';
import { BackHandler } from 'react-native';

export function useAndroidSheetBackHandler(isOpen: boolean, onClose: () => void) {
  const close = useEffectEvent(onClose);

  useEffect(() => {
    // iOS의 BackHandler는 아무 일도 하지 않아 플랫폼 분기가 필요 없다
    if (!isOpen) {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });

    return () => subscription.remove();
  }, [isOpen]);
}
