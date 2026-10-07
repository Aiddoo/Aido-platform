import { ErrorCode } from "@aido/api/errors";
import type { UserRole } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import { addMilliseconds } from "#api/shared/domain/date/utils/arithmetic";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { getSessionValidity } from "../../../domain/policies/auth/session-validity.policy.js";
import { type AuthTokenIssuerPort, type TokenPair } from "../../ports/auth/auth-crypto.port.js";
import { type AuthSessionRepositoryPort } from "../../ports/auth/auth-persistence.port.js";

export interface CreateSessionParams {
  userId: string;
  email: string;
  role: UserRole;
  deviceFingerprint: string;
  userAgent: string;
  ipAddress: string;
}

export interface CreateSessionResult {
  sessionId: string;
  tokens: TokenPair;
  tokenFamily: string;
}

export interface SessionValidatable {
  revokedAt: Date | string | null;
  expiresAt: Date | string;
}

interface SessionServiceDependencies {
  readonly sessionRepository: Pick<AuthSessionRepositoryPort, "create" | "updateRefreshTokenHash">;
  readonly tokenService: Pick<
    AuthTokenIssuerPort,
    | "generateTokenFamily"
    | "generateTokenPair"
    | "hashRefreshToken"
    | "getRefreshTokenExpiresInSeconds"
  >;
}

export class SessionService {
  readonly #dependencies: SessionServiceDependencies;

  constructor(dependencies: SessionServiceDependencies) {
    this.#dependencies = dependencies;
  }

  // 호출자가 연 UoW에 repository의 CLS transaction이 참여한다.
  async createSessionWithTokens(params: CreateSessionParams): Promise<CreateSessionResult> {
    const tokenFamily = this.#dependencies.tokenService.generateTokenFamily();

    const expiresInSeconds = this.#dependencies.tokenService.getRefreshTokenExpiresInSeconds();
    const expiresAt = addMilliseconds(expiresInSeconds * 1000);

    const session = await this.#dependencies.sessionRepository.create({
      userId: params.userId,
      tokenFamily,
      tokenVersion: 1,
      deviceFingerprint: params.deviceFingerprint,
      userAgent: params.userAgent,
      ipAddress: params.ipAddress,
      expiresAt,
    });

    const tokens = await this.#dependencies.tokenService.generateTokenPair(
      params.userId,
      params.email,
      session.id,
      params.role,
      tokenFamily,
      1,
    );

    const refreshTokenHash = this.#dependencies.tokenService.hashRefreshToken(tokens.refreshToken);
    await this.#dependencies.sessionRepository.updateRefreshTokenHash(session.id, refreshTokenHash);

    return {
      sessionId: session.id,
      tokens,
      tokenFamily,
    };
  }

  assertSessionValid(
    session: SessionValidatable | null | undefined,
    sessionId?: string,
  ): asserts session is SessionValidatable {
    if (session == null) {
      throw new ApplicationException(ErrorCode.SESSION_0701, { sessionId });
    }

    const validity = getSessionValidity(
      {
        expiresAt: new Date(session.expiresAt),
        revokedAt: session.revokedAt === null ? null : new Date(session.revokedAt),
      },
      new Date(),
    );

    match(validity)
      .with("valid", () => undefined)
      .with("revoked", () => {
        throw new ApplicationException(ErrorCode.SESSION_0703, { sessionId, reason: undefined });
      })
      .with("expired", () => {
        throw new ApplicationException(ErrorCode.SESSION_0702, { sessionId });
      })
      .exhaustive();
  }
}
