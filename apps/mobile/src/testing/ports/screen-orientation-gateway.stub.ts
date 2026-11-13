import type { ScreenOrientationGateway } from '@src/core/ports/screen-orientation-gateway';

import { mockMethod } from '../mock-method';

export function createScreenOrientationGatewayStub(): jest.Mocked<ScreenOrientationGateway> {
  return {
    lockPortrait: mockMethod<ScreenOrientationGateway['lockPortrait']>(),
    unlock: mockMethod<ScreenOrientationGateway['unlock']>(),
  };
}
