import { useEffect, useEffectEvent } from 'react';
import { BackHandler, Platform } from 'react-native';

export function useAndroidSheetBackHandler(isVisible: boolean, onDismiss: () => void) {
  const dismiss = useEffectEvent(onDismiss);

  useEffect(() => {
    if (Platform.OS !== 'android' || !isVisible) return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      dismiss();
      return true;
    });

    return () => subscription.remove();
  }, [isVisible]);
}
