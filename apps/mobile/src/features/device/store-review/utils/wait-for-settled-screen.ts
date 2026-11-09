import type { AppLifecycleGateway } from '@src/core/ports/app-lifecycle-gateway';

interface WaitForSettledScreenOptions {
  delayMs: number;
  /** 화면이 내려가면(unmount) abort한다 */
  signal: AbortSignal;
  appLifecycle: AppLifecycleGateway;
  /** 기다린 뒤 지금 화면 위에 시트·키보드가 없는지 */
  isScreenReady: () => boolean;
}

// 백그라운드로 가거나 화면이 내려가면 바로 false로 끝나고, 어떻게 끝나든 타이머·AppState 구독·abort 리스너를 정리한다
export function waitForSettledScreen({
  delayMs,
  signal,
  appLifecycle,
  isScreenReady,
}: WaitForSettledScreenOptions): Promise<boolean> {
  if (signal.aborted || appLifecycle.getCurrentState() !== 'active') {
    return Promise.resolve(false);
  }

  return new Promise<boolean>((resolve) => {
    const finish = (isReady: boolean) => {
      clearTimeout(timeout);
      unsubscribe();
      signal.removeEventListener('abort', handleAbort);
      resolve(isReady);
    };
    const handleAbort = () => finish(false);
    const unsubscribe = appLifecycle.subscribe((state) => {
      if (state !== 'active') {
        finish(false);
      }
    });
    const timeout = setTimeout(
      () => finish(appLifecycle.getCurrentState() === 'active' && isScreenReady()),
      delayMs,
    );
    signal.addEventListener('abort', handleAbort, { once: true });
  });
}
