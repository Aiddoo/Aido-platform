import type { SocialShareGateway } from '@src/core/ports/social-share-gateway';

import { mockMethod } from '../mock-method';

/** 카카오톡 같은 소셜 앱이 설치된 기기가 기본값이다 */
export function createSocialShareGatewayStub(): jest.Mocked<SocialShareGateway> {
  return {
    isAvailable: mockMethod<SocialShareGateway['isAvailable']>(() => true),
    shareFeed: mockMethod<SocialShareGateway['shareFeed']>(async () => {}),
  };
}
