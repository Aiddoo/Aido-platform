import { createHash, randomBytes } from "node:crypto";

import type { UserRole } from "@aido/api/vocabulary";
import { Inject, Injectable } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { JwtService, type JwtVerifyOptions } from "@nestjs/jwt";
import ms from "ms";

import { TokenIssuerPort } from "#api/modules/identity/sessions/application/ports/token-issuer.port";
import { jwtConfig } from "#api/platform/config/jwt.config";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { SessionId } from "../../domain/session-id.vo.js";

const JWT_TOKEN_TYPES = ["access", "refresh"] as const;

interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  type: (typeof JWT_TOKEN_TYPES)[number];
  sessionId?: string;
  tokenFamily?: string;
  tokenVersion?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const JWT_ALGORITHM = "HS256";
const JWT_ISSUER = "aido-api";
const JWT_AUDIENCE = "aido-app";

// 가드는 발급과 같은 값으로 검증한다. 값을 바꾸면 이전 값으로 발급한 토큰이 모두 거절된다
export const JWT_VERIFY_OPTIONS = {
  algorithms: [JWT_ALGORITHM],
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
} satisfies JwtVerifyOptions;

const MILLISECONDS_PER_SECOND = 1000;

// Access Token (15분) + Refresh Token (30일) 발급 및 검증, Token Rotation 지원
@Injectable()
export class JwtTokenIssuerAdapter extends TokenIssuerPort {
  readonly #jwtService: JwtService;
  readonly #jwt: ConfigType<typeof jwtConfig>;

  constructor(jwtService: JwtService, @Inject(jwtConfig.KEY) jwt: ConfigType<typeof jwtConfig>) {
    super();
    this.#jwtService = jwtService;
    this.#jwt = jwt;
  }

  async generateTokenPair(
    userId: UserId,
    email: string,
    sessionId: SessionId,
    role: UserRole,
    tokenFamily?: string,
    tokenVersion = 1,
  ): Promise<TokenPair> {
    const family = tokenFamily ?? this.generateTokenFamily();

    const accessToken = await this.#generateAccessToken(userId.value, email, sessionId.value, role);
    const refreshToken = await this.#generateRefreshToken(
      userId.value,
      email,
      sessionId.value,
      role,
      family,
      tokenVersion,
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.#getAccessTokenExpiresInSeconds(),
    };
  }

  // 새로운 로그인 시 생성되는 고유 식별자, Token Rotation 시 동일 패밀리 내에서 버전 증가
  generateTokenFamily(): string {
    return randomBytes(16).toString("hex");
  }

  // DB에 저장할 때 사용 (토큰 자체는 저장하지 않음)
  hashRefreshToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  getRefreshTokenExpiresInSeconds(): number {
    return ms(this.#jwt.refreshExpiresIn) / MILLISECONDS_PER_SECOND;
  }

  async #generateAccessToken(
    userId: string,
    email: string,
    sessionId: string,
    role: UserRole,
  ): Promise<string> {
    const payload: JwtPayload = {
      sub: userId,
      email,
      role,
      type: "access",
      sessionId,
    };

    return this.#jwtService.signAsync(payload, {
      secret: this.#jwt.secret,
      expiresIn: this.#getAccessTokenExpiresInSeconds(),
      algorithm: JWT_ALGORITHM,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  }

  async #generateRefreshToken(
    userId: string,
    email: string,
    sessionId: string,
    role: UserRole,
    tokenFamily: string,
    tokenVersion: number,
  ): Promise<string> {
    const payload: JwtPayload = {
      sub: userId,
      email,
      role,
      type: "refresh",
      sessionId,
      tokenFamily,
      tokenVersion,
    };

    return this.#jwtService.signAsync(payload, {
      secret: this.#jwt.refreshSecret,
      expiresIn: this.getRefreshTokenExpiresInSeconds(),
      algorithm: JWT_ALGORITHM,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  }

  #getAccessTokenExpiresInSeconds(): number {
    return ms(this.#jwt.expiresIn) / MILLISECONDS_PER_SECOND;
  }
}
