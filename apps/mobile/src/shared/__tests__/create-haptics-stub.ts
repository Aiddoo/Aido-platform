import type { HapticsGateway } from '@src/core/ports/haptics-gateway';

export const createHapticsStub = (): jest.Mocked<HapticsGateway> => ({
  selection: jest.fn(),
  impact: jest.fn(),
  notify: jest.fn(),
});
