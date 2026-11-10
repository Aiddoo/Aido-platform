import type { AuthOAuthState } from "../../domain/auth-oauth-state.aggregate.js";
import type { AccountProvider } from "../../domain/auth.constants.js";
import type { OAuthMode } from "./oauth-identity-provider.port.js";

export interface AuthOAuthStateRecord {
  id: number;
  state: string;
  provider: AccountProvider;
  redirectUri: string;
  mode: string | null;
  initiatingUserId: string | null;
  exchangeCode: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  userName: string | null;
  profileImage: string | null;
  accountRestored: boolean | null;
  isNewUser: boolean | null;
  expiresAt: Date;
  exchangedAt: Date | null;
}

export type ConsumeAuthOAuthStateInput = {
  id: number;
  exchangeCode: string;
  at: Temporal.Instant;
} & ({ purpose: "login" } | { purpose: "link"; actorUserId: string });

export abstract class AuthOAuthStateRepositoryPort {
  abstract create(
    state: string,
    provider: AccountProvider,
    redirectUri: string,
    options?: {
      mode?: OAuthMode;
      codeVerifier?: string;
      ipAddress?: string;
      userAgent?: string;
      expiresInMinutes?: number;
      initiatingUserId?: string;
    },
  ): Promise<AuthOAuthStateRecord>;
  abstract findByState(state: string): Promise<AuthOAuthStateRecord | null>;
  abstract findByExchangeCode(
    exchangeCode: string,
    now: Temporal.Instant,
  ): Promise<AuthOAuthState | null>;
  abstract saveExchangeData(
    id: number,
    data: {
      exchangeCode: string;
      accessToken: string;
      refreshToken: string;
      userId: string;
      userName?: string;
      profileImage?: string;
      accountRestored?: boolean;
      isNewUser: boolean;
    },
  ): Promise<unknown>;
  abstract saveLinkingData(
    id: number,
    data: {
      exchangeCode: string;
      provider: AccountProvider;
      providerAccountId: string;
    },
  ): Promise<unknown>;
  abstract consumeExchangeCode(input: ConsumeAuthOAuthStateInput): Promise<boolean>;
  abstract generateExchangeCode(): string;
}
