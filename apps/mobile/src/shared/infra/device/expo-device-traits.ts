import type { DeviceTraits } from '@src/core/ports/device-traits';

import { ANDROID_API_LEVEL } from './device-info';

/** Android 11(API 30)부터 키보드를 따라 움직이는 인셋 애니메이션을 시스템이 지원한다 */
const ANDROID_KEYBOARD_ANIMATION_API_LEVEL = 30;
const IS_LEGACY_ANDROID_KEYBOARD =
  ANDROID_API_LEVEL != null && ANDROID_API_LEVEL < ANDROID_KEYBOARD_ANIMATION_API_LEVEL;

export const expoDeviceTraits: DeviceTraits = {
  hasKeyboardInsetAnimation: !IS_LEGACY_ANDROID_KEYBOARD,
};
