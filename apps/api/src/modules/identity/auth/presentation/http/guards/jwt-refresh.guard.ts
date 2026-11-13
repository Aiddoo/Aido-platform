import { userRoleSchema } from "@aido/api/contracts/auth";
import { type CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { z } from "zod";

import { jwtConfig } from "#api/platform/config/jwt.config";

import { invalidRefreshToken } from "../../../application/auth.errors.js";
import { JWT_ALGORITHM } from "../../../infrastructure/adapters/jwt-token-issuer.adapter.js";
import type { RefreshTokenUser } from "../decorators/authenticated-user.dto.js";
import { readBearerToken } from "../v1/auth-request.mapper.js";

const refreshTokenClaimsSchema = z.looseObject({
  sub: z.string(),
  email: z.string(),
  role: userRoleSchema,
  type: z.literal("refresh"),
  sessionId: z.string().min(1),
});

/** 토큰 갱신 엔드포인트 전용. refresh 토큰을 검증하고 원본 토큰을 함께 `req.user`에 둔다. */
@Injectable()
export class JwtRefreshGuard implements CanActivate {
  readonly #jwtService: JwtService;
  readonly #jwt: ConfigType<typeof jwtConfig>;

  constructor(jwtService: JwtService, @Inject(jwtConfig.KEY) jwt: ConfigType<typeof jwtConfig>) {
    this.#jwtService = jwtService;
    this.#jwt = jwt;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = await this.#authenticate(request.headers.authorization);
    if (user == null) {
      throw invalidRefreshToken();
    }
    request.user = user;
    return true;
  }

  // 서명·만료·타입·세션 id 중 하나라도 틀리면 null이고, 거절 코드는 모두 AUTH_0104다
  async #authenticate(authorization: string | undefined): Promise<RefreshTokenUser | null> {
    const token = readBearerToken(authorization);
    if (token == null || authorization == null) {
      return null;
    }
    try {
      const payload: unknown = await this.#jwtService.verifyAsync(token, {
        secret: this.#jwt.refreshSecret,
        algorithms: [JWT_ALGORITHM],
      });
      const claims = refreshTokenClaimsSchema.safeParse(payload);
      if (!claims.success) {
        return null;
      }
      return {
        userId: claims.data.sub,
        email: claims.data.email,
        sessionId: claims.data.sessionId,
        role: claims.data.role,
        // 회전 대상 hash는 헤더 원문에서 계산해 왔다(Passport 시절과 같은 문자열)
        refreshToken: authorization.replace("Bearer ", "").trim(),
      };
    } catch {
      return null;
    }
  }
}
