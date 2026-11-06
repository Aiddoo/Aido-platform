import { useEffect, useLayoutEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

export function useAndroidSheetBackHandler(isVisible: boolean, onDismiss: () => void) {
  const onDismissRef = useRef(onDismiss);

  useLayoutEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    // iOS의 BackHandler는 아무 일도 하지 않아 플랫폼 분기가 필요 없다
    if (!isVisible) {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onDismissRef.current();
      return true;
    });

    return () => subscription.remove();
  }, [isVisible]);
}
