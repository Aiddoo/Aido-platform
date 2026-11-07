import type { SocialShareGateway } from '@src/core/ports/social-share-gateway';

/** 카카오톡 같은 소셜 앱이 설치된 기기가 기본값이다 */
export const createSocialShareGatewayStub = (): jest.Mocked<SocialShareGateway> => ({
  isAvailable: jest.fn().mockReturnValue(true),
  shareFeed: jest.fn().mockResolvedValue(undefined),
});
