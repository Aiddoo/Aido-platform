type AccessibilitySettingSource = {
  read: () => Promise<boolean>;
  listen: (onChange: (isEnabled: boolean) => void) => () => void;
  onReadError: (error: unknown) => void;
};

/** 구독이 여럿이어도 시스템 리스너와 첫 값 읽기는 한 번만 하고, 첫 값을 읽는 동안 바뀜 이벤트가 먼저 오면 늦게 도착한 읽기 결과로 덮어쓰지 않는다 */
export function createAccessibilitySettingStore({
  read,
  listen,
  onReadError,
}: AccessibilitySettingSource) {
  let isEnabled: boolean | null = null;
  let stopListening: (() => void) | null = null;
  let session = 0;
  let hasHeardChange = false;
  const listeners = new Set<() => void>();

  const update = (next: boolean) => {
    if (next === isEnabled) {
      return;
    }
    isEnabled = next;
    for (const listener of listeners) {
      listener();
    }
  };

  const start = () => {
    session += 1;
    const current = session;
    hasHeardChange = false;
    stopListening = listen((next) => {
      hasHeardChange = true;
      update(next);
    });
    read()
      .then((initialValue) => {
        if (current === session && !hasHeardChange) {
          update(initialValue);
        }
      })
      .catch(onReadError);
  };

  return {
    subscribe: (onStoreChange: () => void) => {
      listeners.add(onStoreChange);
      if (stopListening == null) {
        start();
      }
      return () => {
        listeners.delete(onStoreChange);
        if (listeners.size === 0 && stopListening != null) {
          stopListening();
          stopListening = null;
          session += 1;
        }
      };
    },
    /** 아직 읽지 못했으면 null. 호출한 쪽이 기본값을 정한다. */
    getSnapshot: (): boolean | null => isEnabled,
  };
}
