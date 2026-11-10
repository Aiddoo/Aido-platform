import { createHash, randomBytes } from "node:crypto";

import type { UserRole } from "@aido/api/vocabulary";
import { Injectable } from "@nestjs/common";
import { JwtService, TokenExpiredError } from "@nestjs/jwt";

import {
  AUTH_DEFAULTS,
  TOKEN_VERIFY_ERROR,
  type TokenVerifyError,
} from "#api/modules/identity/auth/domain/auth.constants";
import { TypedConfigService } from "#api/platform/config/services/config.service";

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  type: "access" | "refresh";
  sessionId?: string;
  tokenFamily?: string;
  tokenVersion?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export type TokenVerifyResult<T> =
  | { success: true; payload: T }
  | { success: false; error: TokenVerifyError };

export const JWT_ALGORITHM = "HS256";
// 배포 전 토큰에는 iss·aud가 없어 검증 강제는 7일 refresh가 모두 바뀐 다음 릴리스부터다.
const JWT_ISSUER = "aido-api";
const JWT_AUDIENCE = "aido-app";

// Access Token (15분) + Refresh Token (7일) 발급 및 검증, Token Rotation 지원
@Injectable()
export class JwtTokenIssuerAdapter {
  readonly #jwtService: JwtService;
  readonly #configService: TypedConfigService;

  constructor(jwtService: JwtService, configService: TypedConfigService) {
    this.#jwtService = jwtService;
    this.#configService = configService;
  }

  /**
   * @param tokenFamily - 토큰 패밀리 (기존 값 또는 새로 생성, Token Rotation용)
   * @param tokenVersion - 토큰 버전 (Token Rotation 시 +1)
   */
  async generateTokenPair(
    userId: string,
    email: string,
    sessionId: string,
    role: UserRole,
    tokenFamily?: string,
    tokenVersion = 1,
  ): Promise<TokenPair> {
    const family = tokenFamily ?? this.generateTokenFamily();

    const accessToken = await this.#generateAccessToken(userId, email, sessionId, role);
    const refreshToken = await this.#generateRefreshToken(
      userId,
      email,
      sessionId,
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
      secret: this.#configService.jwtSecret,
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
      secret: this.#configService.jwtRefreshSecret,
      expiresIn: this.getRefreshTokenExpiresInSeconds(),
      algorithm: JWT_ALGORITHM,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  }

  async verifyAccessToken(token: string): Promise<JwtPayload | null> {
    const result = await this.verifyAccessTokenWithError(token);
    return result.success ? result.payload : null;
  }

  async verifyAccessTokenWithError(token: string): Promise<TokenVerifyResult<JwtPayload>> {
    try {
      const payload = await this.#jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.#configService.jwtSecret,
        algorithms: [JWT_ALGORITHM],
      });

      if (payload.type !== "access") {
        return { success: false, error: TOKEN_VERIFY_ERROR.WRONG_TYPE };
      }

      return { success: true, payload };
    } catch (error) {
      return { success: false, error: this.#classifyJwtError(error) };
    }
  }

  async verifyRefreshToken(token: string): Promise<JwtPayload | null> {
    const result = await this.verifyRefreshTokenWithError(token);
    return result.success ? result.payload : null;
  }

  async verifyRefreshTokenWithError(token: string): Promise<TokenVerifyResult<JwtPayload>> {
    try {
      const payload = await this.#jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.#configService.jwtRefreshSecret,
        algorithms: [JWT_ALGORITHM],
      });

      if (payload.type !== "refresh") {
        return { success: false, error: TOKEN_VERIFY_ERROR.WRONG_TYPE };
      }

      return { success: true, payload };
    } catch (error) {
      return { success: false, error: this.#classifyJwtError(error) };
    }
  }

  #classifyJwtError(error: unknown): TokenVerifyError {
    if (error instanceof TokenExpiredError) {
      return TOKEN_VERIFY_ERROR.EXPIRED;
    }
    if (error instanceof Error) {
      if (error.name === "JsonWebTokenError") {
        if (error.message.includes("signature")) {
          return TOKEN_VERIFY_ERROR.INVALID_SIGNATURE;
        }
        return TOKEN_VERIFY_ERROR.MALFORMED;
      }
    }
    return TOKEN_VERIFY_ERROR.MALFORMED;
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
    const expiresIn = this.#configService.jwtExpiresIn;
    return this.#parseExpiresIn(expiresIn);
  }

  getRefreshTokenExpiresInSeconds(): number {
    const expiresIn = this.#configService.jwtRefreshExpiresIn;
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
