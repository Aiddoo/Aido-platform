import { type NativeStackNavigationProp, useNavigation } from 'expo-router';
import type { ParamListBase } from 'expo-router/react-navigation';
import { useEffect, useEffectEvent } from 'react';

type StackNavigation = NativeStackNavigationProp<ParamListBase>;

interface UseOnOpenTransitionEndOptions {
  /** 묶음 Stack의 첫 화면은 묶음이 열리는 전환이 부모 Stack에서 끝난다 */
  isStackRoot?: boolean;
}

/** 네이티브 입력칸·검색창은 전환이 끝나야 붙어 그 뒤에 포커스를 준다. 이 화면이 가려져 있으면 부르지 않는다 */
export function useOnOpenTransitionEnd(
  onOpened: () => void,
  { isStackRoot = false }: UseOnOpenTransitionEndOptions = {},
): void {
  const navigation = useNavigation<StackNavigation>();
  const notifyOpened = useEffectEvent(onOpened);

  useEffect(() => {
    const target = isStackRoot ? navigation.getParent<StackNavigation | undefined>() : navigation;
    return target?.addListener('transitionEnd', (event) => {
      if (!event.data.closing && navigation.isFocused()) {
        notifyOpened();
      }
    });
  }, [isStackRoot, navigation]);
}
