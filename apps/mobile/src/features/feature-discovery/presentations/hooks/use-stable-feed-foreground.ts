import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useOverlayState } from '@src/shared/ui';
import * as Linking from 'expo-linking';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Keyboard } from 'react-native';
import { isStableFeedForeground } from '../state/feature-discovery-auto-open';

export function useStableFeedForeground(hasActiveForm = false): boolean {
  const { status } = useAuth();
  const { hasActiveOverlay } = useOverlayState();
  const [isFocused, setIsFocused] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(Keyboard.isVisible());
  const [hasPendingDeepLink, setHasPendingDeepLink] = useState(true);
  const hasFocusedOnceRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      if (hasFocusedOnceRef.current) {
        setHasPendingDeepLink(false);
      }
      hasFocusedOnceRef.current = true;

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
        }
      })
      .catch(() => {
        if (mounted) {
          setHasPendingDeepLink(true);
        }
      });

    const subscription = Linking.addEventListener('url', () => {
      setHasPendingDeepLink(true);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return isStableFeedForeground({
    isAuthenticated: status === 'authenticated',
    isFocused,
    appState,
    isKeyboardVisible,
    hasActiveOverlay,
    hasPendingDeepLink,
    hasActiveForm,
  });
}
