import { userRoleSchema } from "@aido/api/contracts/auth/v1";
import { type CanActivate, type ExecutionContext, HttpException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { z } from "zod";

import type { HttpRequest } from "#api/platform/http/http-request";
import { ErrorCodedException } from "#api/shared/domain/exceptions/error-coded.exception";

import { TokenVerifierPort } from "../../../application/ports/token-verifier.port.js";
import { invalidAccessToken } from "../../../application/sessions.errors.js";
import { AuthenticateSessionUseCase } from "../../../application/use-cases/authenticate-session.use-case.js";
import { Public } from "../decorators/public.decorator.js";
import { readBearerToken } from "../v1/request-metadata.mapper.js";

const INVALID_ACCESS_TOKEN_REASON = "Access token is missing or invalid";

const accessTokenClaimsSchema = z.looseObject({
  sub: z.string(),
  email: z.string(),
  role: userRoleSchema,
  type: z.string().optional(),
  sessionId: z.string().optional(),
});

/** 전역 access 토큰 가드. `@Public()` 라우트만 건너뛴다. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  readonly #reflector: Reflector;
  readonly #tokenVerifier: TokenVerifierPort;
  readonly #authenticateSession: AuthenticateSessionUseCase;

  constructor(
    reflector: Reflector,
    tokenVerifier: TokenVerifierPort,
    authenticateSession: AuthenticateSessionUseCase,
  ) {
    this.#reflector = reflector;
    this.#tokenVerifier = tokenVerifier;
    this.#authenticateSession = authenticateSession;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.#reflector.getAllAndOverride(Public, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<HttpRequest>();
    const claims = await this.#verify(readBearerToken(request.headers.authorization));
    if (claims == null) {
      throw invalidAccessToken(INVALID_ACCESS_TOKEN_REASON);
    }

    try {
      request.user = await this.#authenticateSession.execute(claims);
    } catch (error) {
      // 인프라 오류(DB·캐시 장애)를 401로 바꾸면 앱이 토큰을 지우고 강제 로그아웃하므로 500으로 둔다.
      // 의도한 인증 거절(세션 폐기·계정 정지 등)은 출시 앱이 아는 AUTH_0101로 통일한다
      if (!(error instanceof HttpException) && !(error instanceof ErrorCodedException)) {
        throw error;
      }
      throw invalidAccessToken(error.message || INVALID_ACCESS_TOKEN_REASON);
    }
    return true;
  }

  async #verify(token: string | null): Promise<z.infer<typeof accessTokenClaimsSchema> | null> {
    if (token == null) {
      return null;
    }
    const parsed = accessTokenClaimsSchema.safeParse(
      await this.#tokenVerifier.verifyAccessToken(token),
    );
    return parsed.success ? parsed.data : null;
  }
}
