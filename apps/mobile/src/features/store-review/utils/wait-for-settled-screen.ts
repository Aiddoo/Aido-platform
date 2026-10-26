import type { AppStateStatus } from 'react-native';

/** React Native `AppState`에서 쓰는 부분만. 테스트에서는 가짜를 넘긴다 */
export interface AppStateSource {
  readonly currentState: string | null | undefined;
  addEventListener(
    type: 'change',
    listener: (state: AppStateStatus) => void,
  ): { remove: () => void };
}

interface WaitForSettledScreenOptions {
  delayMs: number;
  /** 화면이 내려가면(unmount) abort한다 */
  signal: AbortSignal;
  appState: AppStateSource;
  /** 기다린 뒤 지금 화면 위에 시트·키보드가 없는지 */
  isScreenReady: () => boolean;
}

/**
 * 축하 화면이 가라앉을 만큼 기다린 뒤 시스템 창을 띄워도 되는지 알려 준다.
 * 기다리는 사이 앱이 백그라운드로 가거나 화면이 내려가면 즉시 false로 끝나고,
 * 어떤 경로로 끝나든 타이머·AppState 구독·abort 리스너를 모두 정리한다.
 */
export function waitForSettledScreen({
  delayMs,
  signal,
  appState,
  isScreenReady,
}: WaitForSettledScreenOptions): Promise<boolean> {
  if (signal.aborted || appState.currentState !== 'active') {
    return Promise.resolve(false);
  }

  return new Promise<boolean>((resolve) => {
    const finish = (isReady: boolean) => {
      clearTimeout(timeout);
      subscription.remove();
      signal.removeEventListener('abort', handleAbort);
      resolve(isReady);
    };
    const handleAbort = () => finish(false);
    const subscription = appState.addEventListener('change', (state) => {
      if (state !== 'active') {
        finish(false);
      }
    });
    const timeout = setTimeout(
      () => finish(appState.currentState === 'active' && isScreenReady()),
      delayMs,
    );
    signal.addEventListener('abort', handleAbort, { once: true });
  });
}
