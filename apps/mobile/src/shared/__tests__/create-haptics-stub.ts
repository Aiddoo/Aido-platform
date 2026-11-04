import type { HapticsGateway } from '@src/core/ports/haptics';

export const createHapticsStub = (): jest.Mocked<HapticsGateway> => ({
  selection: jest.fn(),
  impact: jest.fn(),
  notify: jest.fn(),
});
