import type { AppWindow } from '@src/shared/domains/window-layout.model';
import { useWindowDimensions } from 'react-native';

import { IS_IOS_APP_ON_MAC } from '../infra/device/device-info';

export function useAppWindow(): AppWindow {
  const { width, height } = useWindowDimensions();

  return { width, height, os: process.env.EXPO_OS, isDesktop: IS_IOS_APP_ON_MAC };
}
