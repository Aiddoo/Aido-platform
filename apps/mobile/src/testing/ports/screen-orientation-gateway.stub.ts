import type { ScreenOrientationGateway } from '@src/core/ports/screen-orientation-gateway';

export function createScreenOrientationGatewayStub(): jest.Mocked<ScreenOrientationGateway> {
  return {
    lockPortrait: jest.fn(),
    unlock: jest.fn(),
  };
}
