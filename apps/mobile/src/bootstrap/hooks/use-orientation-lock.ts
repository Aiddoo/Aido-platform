import { useScreenOrientation } from '@src/bootstrap/providers/di-context';
import { useAppWindow } from '@src/shared/hooks/use-app-window';
import { WindowLayoutPolicy } from '@src/shared/ui/adaptive-pane/window-layout';
import { noop } from 'es-toolkit';
import { useEffect } from 'react';
import { match } from 'ts-pattern';

/** 창 크기가 바뀔 때마다가 아니라 결정이 바뀔 때만 요청한다. 접고 펴면 바깥 화면은 세로로 묶고 안쪽 화면은 푼다 */
export function useOrientationLock() {
  const screenOrientation = useScreenOrientation();
  const orientationLock = WindowLayoutPolicy.getOrientationLock(useAppWindow());

  useEffect(() => {
    match(orientationLock)
      .with('portrait', () => screenOrientation.lockPortrait())
      .with('unlocked', () => screenOrientation.unlock())
      .with(null, noop)
      .exhaustive();
  }, [orientationLock, screenOrientation]);
}
