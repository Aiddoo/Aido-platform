import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';
import { useCallback, useSyncExternalStore } from 'react';

/** 저장소를 인자로 받는 것은 DI 위에 있는 Provider도 같은 훅을 쓰기 위해서다 */
export function useSyncStorageString(storage: ObservableSyncStorage, key: string) {
  const value = useSyncExternalStore(
    useCallback((onChange: () => void) => storage.subscribe(key, onChange), [storage, key]),
    () => storage.get(key),
  );

  const setValue = useCallback(
    (next: string | undefined) => {
      if (next == null) {
        storage.remove(key);
        return;
      }
      storage.set(key, next);
    },
    [storage, key],
  );

  return [value, setValue] as const;
}
