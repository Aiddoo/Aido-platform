import type { DeviceTraits } from '@src/core/ports/device-traits';

import { ANDROID_API_LEVEL, DEVICE_TOTAL_MEMORY_BYTES, IOS_MAJOR_VERSION } from './device-info';

/** Android 11(API 30)부터 키보드를 따라 움직이는 인셋 애니메이션을 시스템이 지원한다 */
const ANDROID_KEYBOARD_ANIMATION_API_LEVEL = 30;
const IS_LEGACY_ANDROID_KEYBOARD =
  ANDROID_API_LEVEL != null && ANDROID_API_LEVEL < ANDROID_KEYBOARD_ANIMATION_API_LEVEL;

const LOW_END_MEMORY_BYTES = 3 * 1024 ** 3;
const IS_LOW_END_DEVICE =
  DEVICE_TOTAL_MEMORY_BYTES != null && DEVICE_TOTAL_MEMORY_BYTES < LOW_END_MEMORY_BYTES;

/** iOS 26부터는 투명 헤더 아래 내용을 시스템 스크롤 엣지 효과가 흐리므로 직접 그린 페이드를 쓰지 않는다. */
const IOS_SCROLL_EDGE_EFFECT_VERSION = 26;
const HAS_NATIVE_EDGE_EFFECT =
  IOS_MAJOR_VERSION != null && IOS_SCROLL_EDGE_EFFECT_VERSION <= IOS_MAJOR_VERSION;

export const expoDeviceTraits: DeviceTraits = {
  hasKeyboardInsetAnimation: !IS_LEGACY_ANDROID_KEYBOARD,
  isLowMemoryDevice: IS_LOW_END_DEVICE,
  hasSystemScrollEdgeEffect: HAS_NATIVE_EDGE_EFFECT,
};
