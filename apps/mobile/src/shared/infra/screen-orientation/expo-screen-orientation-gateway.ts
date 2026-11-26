import type { ScreenOrientationGateway } from '@src/core/ports/screen-orientation-gateway';
import { noop } from 'es-toolkit';
import * as ScreenOrientation from 'expo-screen-orientation';

// 기기가 방향 잠금을 거절해도 화면은 그대로 쓸 수 있다
export const expoScreenOrientationGateway: ScreenOrientationGateway = {
  lockPortrait: () => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(noop);
  },
  unlock: () => {
    ScreenOrientation.unlockAsync().catch(noop);
  },
};
