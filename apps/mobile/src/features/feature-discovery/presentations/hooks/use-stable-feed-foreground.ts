import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useOverlayState } from '@src/shared/ui';
import * as Linking from 'expo-linking';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, InteractionManager, Keyboard } from 'react-native';

import { isStableFeedForeground } from '../state/feature-discovery-auto-open';

export function useStableFeedForeground(): boolean {
  const { status } = useAuth();
  const { hasActiveOverlay } = useOverlayState();
  const [isFocused, setIsFocused] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(Keyboard.isVisible());
  const [hasPendingDeepLink, setHasPendingDeepLink] = useState(true);
  const deepLinkReleaseTaskRef = useRef<ReturnType<
    typeof InteractionManager.runAfterInteractions
  > | null>(null);

  const releasePendingDeepLinkAfterInteractions = useCallback(() => {
    deepLinkReleaseTaskRef.current?.cancel();
    deepLinkReleaseTaskRef.current = InteractionManager.runAfterInteractions(() => {
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
    const keyboardShowSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
    });
    const keyboardHideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      appStateSubscription.remove();
      keyboardShowSubscription.remove();
      keyboardHideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    void Linking.getInitialURL()
      .then((url) => {
        if (mounted) {
          setHasPendingDeepLink(url !== null);
          if (url !== null) {
            releasePendingDeepLinkAfterInteractions();
          }
        }
      })
      .catch(() => {
        if (mounted) {
          setHasPendingDeepLink(true);
          releasePendingDeepLinkAfterInteractions();
        }
      });

    const subscription = Linking.addEventListener('url', () => {
      setHasPendingDeepLink(true);
      releasePendingDeepLinkAfterInteractions();
    });

    return () => {
      mounted = false;
      deepLinkReleaseTaskRef.current?.cancel();
      subscription.remove();
    };
  }, [releasePendingDeepLinkAfterInteractions]);

  return isStableFeedForeground({
    isAuthenticated: status === 'authenticated',
    isFocused,
    appState,
    isKeyboardVisible,
    hasActiveOverlay,
    hasPendingDeepLink,
  });
}
