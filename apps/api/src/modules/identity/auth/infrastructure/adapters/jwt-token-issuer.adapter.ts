import { createHash, randomBytes } from "node:crypto";

import type { UserRole } from "@aido/api/vocabulary";
import { Inject, Injectable } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";

import { AuthTokenIssuerPort } from "#api/modules/identity/auth/application/ports/auth-crypto.port";
import { AUTH_DEFAULTS } from "#api/modules/identity/auth/domain/auth.constants";
import { jwtConfig } from "#api/platform/config/jwt.config";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { SessionId } from "../../domain/session-id.vo.js";

const JWT_TOKEN_TYPES = ["access", "refresh"] as const;

export interface JwtPayload {
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

export const JWT_ALGORITHM = "HS256";
// 배포 전 토큰에는 iss·aud가 없어 검증 강제는 7일 refresh가 모두 바뀐 다음 릴리스부터다.
const JWT_ISSUER = "aido-api";
const JWT_AUDIENCE = "aido-app";

// Access Token (15분) + Refresh Token (7일) 발급 및 검증, Token Rotation 지원
@Injectable()
export class JwtTokenIssuerAdapter extends AuthTokenIssuerPort {
  readonly #jwtService: JwtService;
  readonly #jwt: ConfigType<typeof jwtConfig>;

  constructor(jwtService: JwtService, @Inject(jwtConfig.KEY) jwt: ConfigType<typeof jwtConfig>) {
    super();
    this.#jwtService = jwtService;
    this.#jwt = jwt;
  }

  /**
   * @param tokenFamily - 토큰 패밀리 (기존 값 또는 새로 생성, Token Rotation용)
   * @param tokenVersion - 토큰 버전 (Token Rotation 시 +1)
   */
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

  // 새로운 로그인 시 생성되는 고유 식별자, Token Rotation 시 동일 패밀리 내에서 버전 증가
  generateTokenFamily(): string {
    return randomBytes(16).toString("hex");
  }

  // DB에 저장할 때 사용 (토큰 자체는 저장하지 않음)
  hashRefreshToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  #getAccessTokenExpiresInSeconds(): number {
    const expiresIn = this.#jwt.expiresIn;
    return this.#parseExpiresIn(expiresIn);
  }

  getRefreshTokenExpiresInSeconds(): number {
    const expiresIn = this.#jwt.refreshExpiresIn;
    return this.#parseExpiresIn(expiresIn);
  }

  // "15m", "1h", "7d" 형식을 초 단위로 변환
  #parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match?.[1] || !match[2]) {
      return AUTH_DEFAULTS.DEFAULT_ACCESS_TOKEN_EXPIRES_SECONDS;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case "s":
        return value;
      case "m":
        return value * 60;
      case "h":
        return value * 60 * 60;
      case "d":
        return value * 60 * 60 * 24;
      default:
        return AUTH_DEFAULTS.DEFAULT_ACCESS_TOKEN_EXPIRES_SECONDS;
    }
  }
}
