import type { AppLifecycleGateway, AppLifecycleState } from '@src/core/ports/app-lifecycle-gateway';
import { AppState } from 'react-native';

function toLifecycleState(status: string | null | undefined): AppLifecycleState {
  return status === 'active' || status === 'inactive' || status === 'background'
    ? status
    : 'unknown';
}

export const reactNativeAppLifecycleGateway: AppLifecycleGateway = {
  getCurrentState: () => toLifecycleState(AppState.currentState),
  subscribe: (listener) => {
    const subscription = AppState.addEventListener('change', (status) => {
      listener(toLifecycleState(status));
    });
    return () => subscription.remove();
  },
};
