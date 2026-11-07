import type { ExternalLinkGateway } from '@src/core/ports/external-link-gateway';
import type { IncomingLinkGateway } from '@src/core/ports/incoming-link-gateway';

export const createExternalLinkGatewayStub = (): jest.Mocked<ExternalLinkGateway> => ({
  open: jest.fn().mockResolvedValue(undefined),
  openInAppBrowser: jest.fn().mockResolvedValue(undefined),
  openSettings: jest.fn().mockResolvedValue(undefined),
});

export const createIncomingLinkGatewayStub = (): jest.Mocked<IncomingLinkGateway> => ({
  getInitialUrl: jest.fn().mockResolvedValue(null),
  subscribe: jest.fn().mockReturnValue(() => {}),
});
