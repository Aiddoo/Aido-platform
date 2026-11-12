import { type Href, useRouter } from 'expo-router';
import { use, useRef, useState } from 'react';

import { ToastLayerClosingContext } from '../toast/toast-layer';
import { exitSheetRoute, type SheetRouteExit } from './sheet-route';

const BACK: SheetRouteExit = { type: 'back' };

/** 애니메이션이 끝나 `onOpenChange(false)`가 오면 route를 한 번만 떠난다 */
export function useSheetRoute(fallbackHref: Href) {
  const router = useRouter();
  const startToastLayerClosing = use(ToastLayerClosingContext);
  const [isOpen, setIsOpen] = useState(true);
  const pendingExitRef = useRef<SheetRouteExit>(BACK);
  const hasExitedRef = useRef(false);

  const exit = (next: SheetRouteExit = pendingExitRef.current) => {
    if (hasExitedRef.current) {
      return;
    }
    hasExitedRef.current = true;
    startToastLayerClosing?.();
    exitSheetRoute(router, next, fallbackHref);
  };

  // 닫힘 애니메이션을 기다리지 않고 알려, 같은 흐름이 방금 띄운 토스트가 닫히는 시트에 그려졌다 사라지지 않게 한다
  const close = (next: SheetRouteExit = BACK) => {
    pendingExitRef.current = next;
    startToastLayerClosing?.();
    setIsOpen(false);
  };

  const handleOpenChange = (nextIsOpen: boolean) => {
    if (nextIsOpen) {
      return;
    }
    setIsOpen(false);
    exit();
  };

  return { isOpen, close, exit, onOpenChange: handleOpenChange };
}
