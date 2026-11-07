export interface OAuthSessionRequest {
  /** API 서버의 로그인 시작 경로 */
  startPath: string;
  /** 앱으로 돌아올 경로 */
  callbackPath: string;
  /** `redirect_uri` 뒤에 붙일 시작 쿼리 */
  params: Record<string, string>;
}

export type OAuthSessionResult =
  | { type: 'success'; url: string; queryParams: Record<string, string> }
  | { type: 'cancelled' }
  | { type: 'failed' };

export type AppleSignInResult =
  | { type: 'success'; identityToken: string; nonce: string; givenName: string | null }
  | { type: 'cancelled' }
  | { type: 'no-token' }
  | { type: 'invalid-response' }
  | { type: 'unavailable' }
  | { type: 'failed' };

/** 소셜 로그인의 네이티브 화면. 브라우저 세션과 Apple 로그인 창을 연다 */
export interface SocialAuthGateway {
  openOAuthSession(request: OAuthSessionRequest): Promise<OAuthSessionResult>;
  signInWithApple(): Promise<AppleSignInResult>;
  /** 브라우저 세션이 딥링크로 돌아왔을 때 세션을 끝낸다. 해당 세션이 없으면 아무것도 하지 않는다 */
  completeOAuthSession(): void;
}
