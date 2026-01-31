import { createHash, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { JwtService, TokenExpiredError } from "@nestjs/jwt";

import { TypedConfigService } from "@/common/config/services/config.service";
import {
	AUTH_DEFAULTS,
	TOKEN_VERIFY_ERROR,
	type TokenVerifyError,
} from "../constants/auth.constants";

export interface JwtPayload {
	sub: string;
	email: string;
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

// Access Token (15분) + Refresh Token (7일) 발급 및 검증, Token Rotation 지원
@Injectable()
export class TokenService {
	constructor(
		private readonly jwtService: JwtService,
		private readonly configService: TypedConfigService,
	) {}

	/**
	 * @param tokenFamily - 토큰 패밀리 (기존 값 또는 새로 생성, Token Rotation용)
	 * @param tokenVersion - 토큰 버전 (Token Rotation 시 +1)
	 */
	async generateTokenPair(
		userId: string,
		email: string,
		sessionId: string,
		tokenFamily?: string,
		tokenVersion = 1,
	): Promise<TokenPair> {
		const family = tokenFamily ?? this.generateTokenFamily();

		const accessToken = await this._generateAccessToken(
			userId,
			email,
			sessionId,
		);
		const refreshToken = await this._generateRefreshToken(
			userId,
			email,
			sessionId,
			family,
			tokenVersion,
		);

		return {
			accessToken,
			refreshToken,
			expiresIn: this._getAccessTokenExpiresInSeconds(),
		};
	}

	private async _generateAccessToken(
		userId: string,
		email: string,
		sessionId: string,
	): Promise<string> {
		const payload: JwtPayload = {
			sub: userId,
			email,
			type: "access",
			sessionId,
		};

		return this.jwtService.signAsync(payload, {
			secret: this.configService.jwtSecret,
			expiresIn: this._getAccessTokenExpiresInSeconds(),
		});
	}

	private async _generateRefreshToken(
		userId: string,
		email: string,
		sessionId: string,
		tokenFamily: string,
		tokenVersion: number,
	): Promise<string> {
		const payload: JwtPayload = {
			sub: userId,
			email,
			type: "refresh",
			sessionId,
			tokenFamily,
			tokenVersion,
		};

		return this.jwtService.signAsync(payload, {
			secret: this.configService.jwtRefreshSecret,
			expiresIn: this.getRefreshTokenExpiresInSeconds(),
		});
	}

	async verifyAccessToken(token: string): Promise<JwtPayload | null> {
		const result = await this.verifyAccessTokenWithError(token);
		return result.success ? result.payload : null;
	}

	async verifyAccessTokenWithError(
		token: string,
	): Promise<TokenVerifyResult<JwtPayload>> {
		try {
			const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
				secret: this.configService.jwtSecret,
			});

			if (payload.type !== "access") {
				return { success: false, error: TOKEN_VERIFY_ERROR.WRONG_TYPE };
			}

			return { success: true, payload };
		} catch (error) {
			return { success: false, error: this._classifyJwtError(error) };
		}
	}

	async verifyRefreshToken(token: string): Promise<JwtPayload | null> {
		const result = await this.verifyRefreshTokenWithError(token);
		return result.success ? result.payload : null;
	}

	async verifyRefreshTokenWithError(
		token: string,
	): Promise<TokenVerifyResult<JwtPayload>> {
		try {
			const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
				secret: this.configService.jwtRefreshSecret,
			});

			if (payload.type !== "refresh") {
				return { success: false, error: TOKEN_VERIFY_ERROR.WRONG_TYPE };
			}

			return { success: true, payload };
		} catch (error) {
			return { success: false, error: this._classifyJwtError(error) };
		}
	}

	private _classifyJwtError(error: unknown): TokenVerifyError {
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

	private _getAccessTokenExpiresInSeconds(): number {
		const expiresIn = this.configService.jwtExpiresIn;
		return this._parseExpiresIn(expiresIn);
	}

	getRefreshTokenExpiresInSeconds(): number {
		const expiresIn = this.configService.jwtRefreshExpiresIn;
		return this._parseExpiresIn(expiresIn);
	}

	// "15m", "1h", "7d" 형식을 초 단위로 변환
	private _parseExpiresIn(expiresIn: string): number {
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
