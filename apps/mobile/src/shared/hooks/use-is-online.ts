import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

function subscribe(onStoreChange: () => void) {
  return onlineManager.subscribe(onStoreChange);
}
function getSnapshot() {
  return onlineManager.isOnline();
}

/** React Query `onlineManager`가 보는 연결 상태. 연결 감지의 단일 원본은 `OnlineManagerProvider`다 */
export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
