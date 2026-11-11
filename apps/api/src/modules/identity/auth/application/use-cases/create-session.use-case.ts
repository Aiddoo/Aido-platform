import type { UserRole } from "@aido/api/vocabulary";

import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { AuthSession } from "../../domain/auth-session.aggregate.js";
import type { AuthTokenIssuerPort, TokenPair } from "../ports/auth-crypto.port.js";
import type { AuthSessionRepositoryPort } from "../ports/auth-session.repository.port.js";

export interface CreateSessionCommand {
  readonly userId: string;
  readonly email: string;
  readonly role: UserRole;
  readonly deviceFingerprint: string;
  readonly userAgent: string;
  readonly ipAddress: string;
}

export interface CreatedSession {
  readonly sessionId: string;
  readonly tokens: TokenPair;
  readonly tokenFamily: string;
}

export interface CreateSessionDependencies {
  readonly sessionRepository: Pick<AuthSessionRepositoryPort, "nextId" | "save">;
  readonly tokenService: Pick<
    AuthTokenIssuerPort,
    | "generateTokenFamily"
    | "generateTokenPair"
    | "hashRefreshToken"
    | "getRefreshTokenExpiresInSeconds"
  >;
  readonly clock: ClockPort;
}

/** 새 로그인 세션과 토큰 한 쌍을 만든다. 호출자가 연 UoW에 함께 커밋된다 */
export class CreateSessionUseCase {
  readonly #dependencies: CreateSessionDependencies;

  constructor(dependencies: CreateSessionDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: CreateSessionCommand): Promise<CreatedSession> {
    const { sessionRepository, tokenService, clock } = this.#dependencies;
    const now = clock.now();
    const sessionId = await sessionRepository.nextId();
    const tokenFamily = tokenService.generateTokenFamily();
    const tokens = await tokenService.generateTokenPair(
      UserId.reconstitute(command.userId),
      command.email,
      sessionId,
      command.role,
      tokenFamily,
      1,
    );

    const session = AuthSession.create({
      id: sessionId,
      userId: command.userId,
      refreshTokenHash: tokenService.hashRefreshToken(tokens.refreshToken),
      tokenFamily,
      deviceFingerprint: command.deviceFingerprint,
      userAgent: command.userAgent,
      ipAddress: command.ipAddress,
      expiresAt: now.add({ seconds: tokenService.getRefreshTokenExpiresInSeconds() }),
      now,
    });
    await sessionRepository.save(session);

    return { sessionId: sessionId.value, tokens, tokenFamily };
  }
}
