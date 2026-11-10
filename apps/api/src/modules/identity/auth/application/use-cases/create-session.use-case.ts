import type { UserRole } from "@aido/api/vocabulary";

import type { ClockPort } from "#api/shared/application/ports/clock.port";

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
  readonly sessionRepository: Pick<AuthSessionRepositoryPort, "create" | "updateRefreshTokenHash">;
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
    const tokenFamily = tokenService.generateTokenFamily();
    const expiresAt = clock.now().add({ seconds: tokenService.getRefreshTokenExpiresInSeconds() });

    const session = await sessionRepository.create({
      userId: command.userId,
      tokenFamily,
      tokenVersion: 1,
      deviceFingerprint: command.deviceFingerprint,
      userAgent: command.userAgent,
      ipAddress: command.ipAddress,
      expiresAt,
    });

    // refresh 토큰은 세션 id를 담아야 해서 세션을 먼저 만든 뒤 hash를 채운다
    const tokens = await tokenService.generateTokenPair(
      command.userId,
      command.email,
      session.id,
      command.role,
      tokenFamily,
      1,
    );
    await sessionRepository.updateRefreshTokenHash(
      session.id,
      tokenService.hashRefreshToken(tokens.refreshToken),
    );

    return { sessionId: session.id, tokens, tokenFamily };
  }
}
