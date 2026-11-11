import { useAppLifecycle, useIncomingLink } from '@src/bootstrap/providers/di-context';
import { useAppLifecycleState } from '@src/shared/hooks/use-app-lifecycle-state';
import { useOverlayState } from '@src/shared/ui';
import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useKeyboardState } from 'react-native-keyboard-controller';

import { isStableFeedForeground } from '../utils/is-stable-feed-foreground';

/** 로그인 상태와 곧 일어날 이동은 shared가 모르는 일이라 화면이 넘긴다 */
export function useStableFeedForeground({
  isAuthenticated,
  hasPendingNavigation,
}: {
  isAuthenticated: boolean;
  hasPendingNavigation: boolean;
}): boolean {
  const incomingLink = useIncomingLink();
  const { hasActiveOverlay } = useOverlayState();
  const isFocused = useIsFocused();
  const appLifecycle = useAppLifecycle();
  const isAppActive = useAppLifecycleState() === 'active';
  const isKeyboardVisible = useKeyboardState((state) => state.isVisible);
  const [hasPendingDeepLink, setHasPendingDeepLink] = useState(true);
  const deepLinkReleaseTaskRef = useRef<number | null>(null);

  const releasePendingDeepLinkWhenIdle = useCallback(() => {
    if (deepLinkReleaseTaskRef.current != null) {
      cancelIdleCallback(deepLinkReleaseTaskRef.current);
    }
    deepLinkReleaseTaskRef.current = requestIdleCallback(() => {
      deepLinkReleaseTaskRef.current = null;
      setHasPendingDeepLink(false);
    });
  }, []);

  useEffect(() => {
    return appLifecycle.subscribe((nextState) => {
      if (nextState !== 'active') {
        setHasPendingDeepLink(false);
      }
    });
  }, [appLifecycle]);

  useEffect(() => {
    const lifecycle = new AbortController();
    incomingLink
      .getInitialUrl()
      .then((url) => {
        if (!lifecycle.signal.aborted) {
          setHasPendingDeepLink(url != null);
          if (url != null) {
            releasePendingDeepLinkWhenIdle();
          }
        }
      })
      .catch(() => {
        if (!lifecycle.signal.aborted) {
          setHasPendingDeepLink(true);
          releasePendingDeepLinkWhenIdle();
        }
      });

    const unsubscribe = incomingLink.subscribe(() => {
      setHasPendingDeepLink(true);
      releasePendingDeepLinkWhenIdle();
    });

    return () => {
      lifecycle.abort();
      if (deepLinkReleaseTaskRef.current != null) {
        cancelIdleCallback(deepLinkReleaseTaskRef.current);
      }
      unsubscribe();
    };
  }, [incomingLink, releasePendingDeepLinkWhenIdle]);

  return isStableFeedForeground({
    isAuthenticated,
    isFocused,
    isAppActive,
    isKeyboardVisible,
    hasActiveOverlay,
    hasPendingDeepLink,
    hasPendingNavigation,
  });
}
