import type { TokenPair } from "../ports/token-issuer.port.js";

export interface EmailVerificationReadModel {
  userId: string;
  userTag: string;
  tokens: TokenPair;
  name: string | null;
  profileImage: string | null;
  accountRestored?: boolean;
}

export interface LoginReadModel {
  userId: string;
  userTag: string;
  tokens: TokenPair;
  sessionId: string;
  name: string | null;
  profileImage: string | null;
  accountRestored?: boolean;
}

/** `isNewUser`는 이번 요청에서 사용자를 새로 만들었을 때만 true다 */
export interface SocialLoginReadModel extends LoginReadModel {
  isNewUser: boolean;
}

export interface RefreshedTokensReadModel {
  tokens: TokenPair;
  sessionId: string;
}
