import { createEventChannel } from '@src/core/events/event-channel';
import type { AppLifecycleGateway, AppLifecycleState } from '@src/core/ports/app-lifecycle-gateway';
import { AppState, type NativeEventSubscription } from 'react-native';

function toLifecycleState(status: string | null | undefined): AppLifecycleState {
  return status === 'active' || status === 'inactive' || status === 'background'
    ? status
    : 'unknown';
}

/**
 * 네이티브 `AppState` 리스너는 첫 구독자가 생길 때 하나만 걸고 모든 구독자에게 나눠 준다.
 * 마지막 구독자가 떠나면 네이티브 구독도 푼다.
 */
function createReactNativeAppLifecycleGateway(): AppLifecycleGateway {
  const channel = createEventChannel<AppLifecycleState>('app-lifecycle');
  let listenerCount = 0;
  let nativeSubscription: NativeEventSubscription | null = null;

  return {
    getCurrentState: () => toLifecycleState(AppState.currentState),
    subscribe: (listener) => {
      const unsubscribe = channel.subscribe(listener);
      listenerCount += 1;
      nativeSubscription ??= AppState.addEventListener('change', (status) => {
        channel.emit(toLifecycleState(status));
      });

      let isSubscribed = true;
      return () => {
        if (!isSubscribed) {
          return;
        }
        isSubscribed = false;
        unsubscribe();
        listenerCount -= 1;
        if (listenerCount === 0) {
          nativeSubscription?.remove();
          nativeSubscription = null;
        }
      };
    },
  };
}

export const reactNativeAppLifecycleGateway = createReactNativeAppLifecycleGateway();
