import type { UserRole } from "@aido/api/vocabulary";

import type { TokenPair } from "../ports/token-issuer.port.js";

export interface VerifyEmailResult {
  userId: string;
  userTag: string;
  tokens: TokenPair;
  name: string | null;
  profileImage: string | null;
  accountRestored?: boolean;
}

export interface LoginResult {
  userId: string;
  userTag: string;
  tokens: TokenPair;
  sessionId: string;
  name: string | null;
  profileImage: string | null;
  accountRestored?: boolean;
}

/** `isNewUser`는 이번 요청에서 사용자를 새로 만들었을 때만 true다 */
export interface SocialLoginResult extends LoginResult {
  isNewUser: boolean;
}

export interface RefreshTokensResult {
  tokens: TokenPair;
  sessionId: string;
}

/** refresh 가드가 검증한 refresh 토큰 정보 */
export interface VerifiedRefreshPayload {
  userId: string;
  email: string;
  sessionId: string;
  role: UserRole;
}
