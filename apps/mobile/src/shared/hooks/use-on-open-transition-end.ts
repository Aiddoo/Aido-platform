import { useNavigation } from 'expo-router';
import { useEffect, useEffectEvent } from 'react';

/** 내비게이션 타입이 네이티브 스택의 transitionEnd를 드러내지 않아 쓰는 이벤트만 적는다 */
interface TransitionNavigation {
  addListener(
    event: 'transitionEnd',
    callback: (event: { data: { closing: boolean } }) => void,
  ): () => void;
  getParent(): TransitionNavigation | undefined;
  isFocused(): boolean;
}

interface UseOnOpenTransitionEndOptions {
  /** 묶음 Stack의 첫 화면은 묶음이 열리는 전환이 부모 Stack에서 끝난다 */
  isStackRoot?: boolean;
}

/**
 * 화면이 열리는(닫히지 않는) 전환이 끝나면 부른다. 네이티브 입력칸·검색창은 전환이 끝나야 붙어 그 뒤에 포커스를 준다.
 * 위 화면이 닫혀 이 화면이 다시 보일 때도 부르고, 이 화면이 가려져 있으면 부르지 않는다
 */
export function useOnOpenTransitionEnd(
  onOpened: () => void,
  { isStackRoot = false }: UseOnOpenTransitionEndOptions = {},
): void {
  const navigation = useNavigation<TransitionNavigation>();
  const notifyOpened = useEffectEvent(onOpened);

  useEffect(() => {
    const target = isStackRoot ? navigation.getParent() : navigation;
    return target?.addListener('transitionEnd', (event) => {
      if (!event.data.closing && navigation.isFocused()) {
        notifyOpened();
      }
    });
  }, [isStackRoot, navigation]);
}
