import { userRoleSchema } from "@aido/api/contracts/auth/v1";
import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { z } from "zod";

import type { HttpRequest } from "#api/platform/http/http-request";

import { TokenVerifierPort } from "../../../application/ports/token-verifier.port.js";
import { invalidRefreshToken } from "../../../application/sessions.errors.js";
import type { RefreshTokenUser } from "../decorators/authenticated-user.dto.js";
import { readBearerToken } from "../v1/request-metadata.mapper.js";

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
  readonly #tokenVerifier: TokenVerifierPort;

  constructor(tokenVerifier: TokenVerifierPort) {
    this.#tokenVerifier = tokenVerifier;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<HttpRequest>();
    const user = await this.#authenticate(request.headers.authorization);
    if (user == null) {
      throw invalidRefreshToken();
    }
    request.user = user;
    return true;
  }

  // 서명·발급자·대상·만료·타입·세션 id 중 하나라도 틀리면 null이고, 거절 코드는 모두 AUTH_0104다
  async #authenticate(authorization: string | undefined): Promise<RefreshTokenUser | null> {
    const token = readBearerToken(authorization);
    if (token == null || authorization == null) {
      return null;
    }
    const claims = refreshTokenClaimsSchema.safeParse(
      await this.#tokenVerifier.verifyRefreshToken(token),
    );
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
  }
}
