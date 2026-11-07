import type { SystemShareGateway } from '@src/core/ports/system-share-gateway';

/** 공유 시트가 열리고 이미지 공유도 되는 기기가 기본값이다 */
export const createSystemShareGatewayStub = (): jest.Mocked<SystemShareGateway> => ({
  share: jest.fn().mockResolvedValue(true),
  canShareImage: jest.fn().mockResolvedValue(true),
  shareImage: jest.fn().mockResolvedValue(undefined),
});
