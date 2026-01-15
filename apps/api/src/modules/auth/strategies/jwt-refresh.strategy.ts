import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import type { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";
import { TypedConfigService } from "@/common/config/services/config.service";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import type { JwtPayload } from "../services/token.service";

/**
 * Refresh Token 요청에서 추출된 정보
 */
export interface RefreshTokenPayload {
	userId: string;
	email: string;
	sessionId: string;
	refreshToken: string;
}

/**
 * JWT Refresh Token Strategy
 *
 * Authorization: Bearer <refresh_token> 헤더 또는 요청 본문에서 토큰을 추출하여 검증합니다.
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
	Strategy,
	"jwt-refresh",
) {
	constructor(readonly configService: TypedConfigService) {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
			secretOrKey: configService.get("JWT_REFRESH_SECRET"),
			passReqToCallback: true,
		});
	}

	/**
	 * JWT 페이로드 검증 및 Refresh Token 정보 반환
	 */
	async validate(
		req: Request,
		payload: JwtPayload,
	): Promise<RefreshTokenPayload> {
		// Refresh Token 타입 확인
		if (payload.type !== "refresh") {
			throw BusinessExceptions.refreshTokenInvalid();
		}

		// sessionId 필수 확인
		if (!payload.sessionId) {
			throw BusinessExceptions.refreshTokenInvalid();
		}

		// Authorization 헤더에서 토큰 추출
		const authHeader = req.headers.authorization;
		if (!authHeader) {
			throw BusinessExceptions.refreshTokenInvalid();
		}

		const refreshToken = authHeader.replace("Bearer ", "").trim();

		return {
			userId: payload.sub,
			email: payload.email,
			sessionId: payload.sessionId,
			refreshToken,
		};
	}
}
