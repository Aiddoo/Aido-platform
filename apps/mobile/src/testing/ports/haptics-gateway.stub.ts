import type { HapticsGateway } from '@src/core/ports/haptics-gateway';

export function createHapticsGatewayStub(): jest.Mocked<HapticsGateway> {
  return {
    selection: jest.fn(),
    impact: jest.fn(),
    notify: jest.fn(),
  };
}
