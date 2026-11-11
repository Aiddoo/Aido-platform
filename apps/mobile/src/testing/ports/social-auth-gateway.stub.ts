import type { SocialAuthGateway } from '@src/core/ports/social-auth-gateway';

import { mockMethod } from '../mock-method';

/** 사용자가 로그인 창을 닫는 기기가 기본값이다. 성공 응답은 값이 필요하니 테스트가 정한다 */
export function createSocialAuthGatewayStub(): jest.Mocked<SocialAuthGateway> {
  return {
    openOAuthSession: mockMethod<SocialAuthGateway['openOAuthSession']>(async () => ({
      type: 'cancelled',
    })),
    signInWithApple: mockMethod<SocialAuthGateway['signInWithApple']>(async () => ({
      type: 'cancelled',
    })),
    completeOAuthSession: jest.fn(),
  };
}
