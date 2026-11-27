import type { DeviceTraits } from '@src/core/ports/device-traits';

/** 키보드 인셋 애니메이션이 있고 메모리가 넉넉하며 시스템 스크롤 엣지 효과가 없는 기기 */
export function createDeviceTraitsStub(overrides: Partial<DeviceTraits> = {}): DeviceTraits {
  return {
    hasKeyboardInsetAnimation: true,
    isLowMemoryDevice: false,
    hasSystemScrollEdgeEffect: false,
    ...overrides,
  };
}
