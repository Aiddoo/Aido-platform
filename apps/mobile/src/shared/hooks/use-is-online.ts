import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

const subscribe = (onStoreChange: () => void) => onlineManager.subscribe(onStoreChange);
const getSnapshot = () => onlineManager.isOnline();

/** React Query `onlineManager`가 보는 연결 상태. 연결 감지의 단일 원본은 `OnlineManagerProvider`다 */
export const useIsOnline = (): boolean => useSyncExternalStore(subscribe, getSnapshot);
