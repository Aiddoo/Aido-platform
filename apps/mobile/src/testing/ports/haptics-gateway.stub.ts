import type { HapticsGateway } from '@src/core/ports/haptics-gateway';

import { mockMethod } from '../mock-method';

export function createHapticsGatewayStub(): jest.Mocked<HapticsGateway> {
  return {
    selection: mockMethod<HapticsGateway['selection']>(),
    impact: mockMethod<HapticsGateway['impact']>(),
    notify: mockMethod<HapticsGateway['notify']>(),
  };
}
