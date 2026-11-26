export interface TimerSlots<TKey extends string> {
  set: (key: TKey, callback: () => void, delayMs: number) => void;
  has: (key: TKey) => boolean;
  clear: (key: TKey) => void;
  clearAll: () => void;
}

/** 이름 하나에 타이머 하나. 다시 걸면 앞의 것을 지운다 */
export function createTimerSlots<TKey extends string>(): TimerSlots<TKey> {
  const slots = new Map<TKey, ReturnType<typeof setTimeout>>();

  const clear = (key: TKey) => {
    const timer = slots.get(key);
    if (timer != null) {
      clearTimeout(timer);
      slots.delete(key);
    }
  };

  return {
    set: (key, callback, delayMs) => {
      clear(key);
      slots.set(
        key,
        setTimeout(() => {
          slots.delete(key);
          callback();
        }, delayMs),
      );
    },
    has: (key) => slots.has(key),
    clear,
    clearAll: () => {
      for (const timer of slots.values()) {
        clearTimeout(timer);
      }
      slots.clear();
    },
  };
}
