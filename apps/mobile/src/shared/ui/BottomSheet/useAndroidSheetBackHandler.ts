import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';

export function useAndroidSheetBackHandler(isVisible: boolean, onDismiss: () => void) {
  useEffect(() => {
    if (Platform.OS !== 'android' || !isVisible) return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onDismiss();
      return true;
    });

    return () => subscription.remove();
  }, [isVisible, onDismiss]);
}
