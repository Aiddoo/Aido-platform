import { type Href, useRouter } from 'expo-router';
import { useRef, useState } from 'react';

import { exitSheetRoute, type SheetRouteExit } from './sheet-route';

const BACK: SheetRouteExit = { type: 'back' };

/**
 * route로 띄운 시트의 열림 상태. `close`는 시트 닫기 애니메이션을 시작하고,
 * 애니메이션이 끝나 `onOpenChange(false)`가 오면 route를 한 번만 떠난다.
 */
export function useSheetRoute(fallbackHref: Href) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);
  const pendingExitRef = useRef<SheetRouteExit>(BACK);
  const hasExitedRef = useRef(false);

  function exit(next: SheetRouteExit = pendingExitRef.current) {
    if (hasExitedRef.current) {
      return;
    }
    hasExitedRef.current = true;
    exitSheetRoute(router, next, fallbackHref);
  }

  function close(next: SheetRouteExit = BACK) {
    pendingExitRef.current = next;
    setIsOpen(false);
  }

  function handleOpenChange(nextIsOpen: boolean) {
    if (nextIsOpen) {
      return;
    }
    setIsOpen(false);
    exit();
  }

  return { isOpen, close, exit, onOpenChange: handleOpenChange };
}
