import { useEffect, useLayoutEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';

export function useAndroidSheetBackHandler(isVisible: boolean, onDismiss: () => void) {
  const onDismissRef = useRef(onDismiss);

  useLayoutEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !isVisible) {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onDismissRef.current();
      return true;
    });

    return () => subscription.remove();
  }, [isVisible]);
}
