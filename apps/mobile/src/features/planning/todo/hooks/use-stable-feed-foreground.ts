import { useAppLifecycle, useIncomingLink } from '@src/bootstrap/providers/di-context';
import type { AuthStatus } from '@src/core/session/auth-status';
import { useAppLifecycleState } from '@src/shared/hooks/use-app-lifecycle-state';
import { useOverlayState } from '@src/shared/ui';
import { useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useKeyboardState } from 'react-native-keyboard-controller';

interface StableFeedForegroundInput {
  authStatus: AuthStatus;
  isFocused: boolean;
  isAppActive: boolean;
  isKeyboardVisible: boolean;
  hasActiveOverlay: boolean;
  hasPendingDeepLink: boolean;
  /** 곧 다른 화면으로 넘어갈 일이 남았다. 자동 안내가 그 앞에 끼어들지 않게 한다 */
  hasPendingNavigation: boolean;
}

export function isStableFeedForeground({
  authStatus,
  isFocused,
  isAppActive,
  isKeyboardVisible,
  hasActiveOverlay,
  hasPendingDeepLink,
  hasPendingNavigation,
}: StableFeedForegroundInput): boolean {
  return (
    authStatus === 'authenticated' &&
    isFocused &&
    isAppActive &&
    !isKeyboardVisible &&
    !hasActiveOverlay &&
    !hasPendingDeepLink &&
    !hasPendingNavigation
  );
}

/** 로그인 상태와 곧 일어날 이동은 shared가 모르는 일이라 화면이 넘긴다 */
export function useStableFeedForeground({
  authStatus,
  hasPendingNavigation,
}: {
  authStatus: AuthStatus;
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

  useEffect(() => {
    return appLifecycle.subscribe((nextState) => {
      if (nextState !== 'active') {
        setHasPendingDeepLink(false);
      }
    });
  }, [appLifecycle]);

  useEffect(() => {
    const releasePendingDeepLinkWhenIdle = () => {
      if (deepLinkReleaseTaskRef.current != null) {
        cancelIdleCallback(deepLinkReleaseTaskRef.current);
      }
      deepLinkReleaseTaskRef.current = requestIdleCallback(() => {
        deepLinkReleaseTaskRef.current = null;
        setHasPendingDeepLink(false);
      });
    };

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
  }, [incomingLink]);

  return isStableFeedForeground({
    authStatus,
    isFocused,
    isAppActive,
    isKeyboardVisible,
    hasActiveOverlay,
    hasPendingDeepLink,
    hasPendingNavigation,
  });
}
