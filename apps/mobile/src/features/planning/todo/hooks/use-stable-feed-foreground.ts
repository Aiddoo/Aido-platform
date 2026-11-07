import { useIncomingLink } from '@src/shared/di/shared-di-context';
import { useOverlayState } from '@src/shared/ui';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
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
  const [isFocused, setIsFocused] = useState(false);
  const [appState, setAppState] = useState<AppStateStatus | null>(
    AppState.currentState === 'active' ? 'active' : null,
  );
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

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);

      return () => setIsFocused(false);
    }, []),
  );

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      setAppState(nextState);
      if (nextState !== 'active') {
        setHasPendingDeepLink(false);
      }
    });

    return () => {
      appStateSubscription.remove();
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    incomingLink
      .getInitialUrl()
      .then((url) => {
        if (mounted) {
          setHasPendingDeepLink(url != null);
          if (url != null) {
            releasePendingDeepLinkWhenIdle();
          }
        }
      })
      .catch(() => {
        if (mounted) {
          setHasPendingDeepLink(true);
          releasePendingDeepLinkWhenIdle();
        }
      });

    const unsubscribe = incomingLink.subscribe(() => {
      setHasPendingDeepLink(true);
      releasePendingDeepLinkWhenIdle();
    });

    return () => {
      mounted = false;
      if (deepLinkReleaseTaskRef.current != null) {
        cancelIdleCallback(deepLinkReleaseTaskRef.current);
      }
      unsubscribe();
    };
  }, [incomingLink, releasePendingDeepLinkWhenIdle]);

  return isStableFeedForeground({
    isAuthenticated,
    isFocused,
    appState,
    isKeyboardVisible,
    hasActiveOverlay,
    hasPendingDeepLink,
    hasPendingNavigation,
  });
}
