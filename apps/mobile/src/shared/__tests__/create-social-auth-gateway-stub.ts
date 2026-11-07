import type {
  AppleSignInResult,
  OAuthSessionRequest,
  OAuthSessionResult,
  SocialAuthGateway,
} from '@src/core/ports/social-auth-gateway';

export function createSocialAuthGatewayStub(): jest.Mocked<SocialAuthGateway> {
  return {
    openOAuthSession: jest.fn<Promise<OAuthSessionResult>, [OAuthSessionRequest]>(async () => ({
      type: 'cancelled',
    })),
    completeOAuthSession: jest.fn(),
    signInWithApple: jest.fn<Promise<AppleSignInResult>, []>(async () => ({
      type: 'success',
      identityToken: 'apple-id-token',
      nonce: 'apple-nonce',
      givenName: null,
    })),
  };
}
