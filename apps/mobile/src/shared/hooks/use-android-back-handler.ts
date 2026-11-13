import { useIsFocused } from 'expo-router';
import { useEffect, useEffectEvent } from 'react';
import { BackHandler } from 'react-native';

interface UseAndroidBackHandlerOptions {
  /** 꺼 두면 구독하지 않는다. 화면 포커스와는 따로 묶인다 */
  isEnabled?: boolean;
  /** 처리했으면 true(기본 뒤로 가기를 막는다), 맡기려면 false */
  onBack: () => boolean;
}

/** 화면이 포커스를 가진 동안만 Android 뒤로 가기를 듣는다. iOS의 BackHandler는 아무 일도 하지 않아 플랫폼 분기가 필요 없다 */
export function useAndroidBackHandler({ isEnabled = true, onBack }: UseAndroidBackHandlerOptions) {
  const isFocused = useIsFocused();
  const handleBack = useEffectEvent(onBack);

  useEffect(() => {
    if (!isFocused || !isEnabled) {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => handleBack());

    return () => subscription.remove();
  }, [isFocused, isEnabled]);
}
