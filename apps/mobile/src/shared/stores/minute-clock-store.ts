import { MINUTE_MS } from '@src/shared/constants/time.constants';

type MinuteClockSource = {
  now: () => number;
  /** 앱이 앞으로 오면 true, 뒤로 가면 false를 알린다. 해제 함수를 돌려준다. */
  listenForeground: (onChange: (isForeground: boolean) => void) => () => void;
};

/** 분이 시작한 시각(ms). 같은 분 안에서는 같은 값이라 화면이 다시 그려지지 않는다. */
export function toMinuteStart(ms: number): number {
  return Math.floor(ms / MINUTE_MS) * MINUTE_MS;
}

/**
 * 분 단위 현재 시각을 useSyncExternalStore로 구독하는 저장소.
 * 구독이 있고 앱이 앞에 있을 때만 다음 분 경계에 타이머 하나를 예약하고, 앱이 돌아오면 바로 알린다.
 */
export function createMinuteClockStore({ now, listenForeground }: MinuteClockSource) {
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopListening: (() => void) | null = null;

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const cancel = () => {
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const schedule = () => {
    cancel();
    const current = now();
    timer = setTimeout(
      () => {
        timer = null;
        notify();
        schedule();
      },
      toMinuteStart(current) + MINUTE_MS - current,
    );
  };

  return {
    subscribe(onStoreChange: () => void) {
      listeners.add(onStoreChange);
      if (stopListening == null) {
        schedule();
        stopListening = listenForeground((isForeground) => {
          if (!isForeground) {
            cancel();
            return;
          }
          notify();
          schedule();
        });
      }
      return () => {
        listeners.delete(onStoreChange);
        if (listeners.size === 0) {
          cancel();
          stopListening?.();
          stopListening = null;
        }
      };
    },
    getSnapshot: (): number => toMinuteStart(now()),
  };
}
