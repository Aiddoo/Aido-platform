import type { ScreenOrientationGateway } from '@src/core/ports/screen-orientation-gateway';
import { noop } from 'es-toolkit';
import * as ScreenOrientation from 'expo-screen-orientation';

export const expoScreenOrientationGateway: ScreenOrientationGateway = {
  lockPortrait: () => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(noop);
  },
  unlock: () => {
    ScreenOrientation.unlockAsync().catch(noop);
  },
};
