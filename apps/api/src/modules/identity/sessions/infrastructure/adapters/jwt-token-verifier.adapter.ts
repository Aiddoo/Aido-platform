import { Inject, Injectable } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";

import { jwtConfig } from "#api/platform/config/jwt.config";

import type { TokenVerifierPort } from "../../application/ports/token-verifier.port.js";
import { JWT_VERIFY_OPTIONS } from "./jwt-token-issuer.adapter.js";

@Injectable()
export class JwtTokenVerifierAdapter implements TokenVerifierPort {
  readonly #jwtService: JwtService;
  readonly #jwt: ConfigType<typeof jwtConfig>;

  constructor(jwtService: JwtService, @Inject(jwtConfig.KEY) jwt: ConfigType<typeof jwtConfig>) {
    this.#jwtService = jwtService;
    this.#jwt = jwt;
  }

  verifyAccessToken(token: string): Promise<unknown> {
    return this.#verify(token, this.#jwt.secret);
  }

  verifyRefreshToken(token: string): Promise<unknown> {
    return this.#verify(token, this.#jwt.refreshSecret);
  }

  // 검증 실패의 이유를 가리지 않는다(Passport 시절의 fail과 같다)
  async #verify(token: string, secret: string): Promise<unknown> {
    try {
      const payload: unknown = await this.#jwtService.verifyAsync(token, {
        ...JWT_VERIFY_OPTIONS,
        secret,
      });
      return payload;
    } catch {
      return null;
    }
  }
}
