import { userRoleSchema } from "@aido/api/contracts/auth";
import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  Inject,
  Injectable,
} from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { z } from "zod";

import { jwtConfig } from "#api/platform/config/jwt.config";
import { ErrorCodedException } from "#api/shared/domain/exceptions/error-coded.exception";

import { invalidAccessToken } from "../../../application/auth.errors.js";
import { AuthenticateSessionUseCase } from "../../../application/use-cases/authenticate-session.use-case.js";
import { JWT_ALGORITHM } from "../../../infrastructure/adapters/jwt-token-issuer.adapter.js";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator.js";
import { readBearerToken } from "../v1/auth-request.mapper.js";

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
  readonly #jwtService: JwtService;
  readonly #jwt: ConfigType<typeof jwtConfig>;
  readonly #authenticateSession: AuthenticateSessionUseCase;

  constructor(
    reflector: Reflector,
    jwtService: JwtService,
    @Inject(jwtConfig.KEY) jwt: ConfigType<typeof jwtConfig>,
    authenticateSession: AuthenticateSessionUseCase,
  ) {
    this.#reflector = reflector;
    this.#jwtService = jwtService;
    this.#jwt = jwt;
    this.#authenticateSession = authenticateSession;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.#reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
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

  // 서명·알고리즘·만료가 하나라도 틀리면 이유를 가리지 않고 null이다(Passport 시절의 fail과 같다)
  async #verify(token: string | null): Promise<z.infer<typeof accessTokenClaimsSchema> | null> {
    if (token == null) {
      return null;
    }
    try {
      const payload: unknown = await this.#jwtService.verifyAsync(token, {
        secret: this.#jwt.secret,
        algorithms: [JWT_ALGORITHM],
      });
      const parsed = accessTokenClaimsSchema.safeParse(payload);
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }
}
