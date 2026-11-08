import type { AppLifecycleGateway } from '@src/core/ports/app-lifecycle-gateway';

interface WaitForSettledScreenOptions {
  delayMs: number;
  signal: AbortSignal;
  appLifecycle: AppLifecycleGateway;
  /** 기다린 뒤 지금 화면 위에 시트·키보드가 없는지 */
  isScreenReady: () => boolean;
}

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
