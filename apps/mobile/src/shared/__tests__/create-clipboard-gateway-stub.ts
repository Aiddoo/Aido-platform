import type { ClipboardGateway } from '@src/core/ports/clipboard-gateway';

/** 클립보드가 비어 있는 기기가 기본값이다 */
export const createClipboardGatewayStub = (): jest.Mocked<ClipboardGateway> => ({
  hasContent: jest.fn().mockResolvedValue(false),
  paste: jest.fn().mockResolvedValue(''),
  copy: jest.fn().mockResolvedValue(undefined),
});
