import { Inject, Injectable, Logger } from "@nestjs/common";
import { importPKCS8, SignJWT } from "jose";

import { TypedConfigService } from "#api/platform/config/services/config.service";

import { WeatherKitLogEvent } from "../../observability/forecast/weatherkit-log.events.js";

const TOKEN_LIFETIME_SECONDS = 60 * 60;
/** 만료 직전 토큰이 요청 도중 만료되지 않도록 5분 일찍 새로 서명한다. */
const REFRESH_MARGIN_MS = 5 * 60_000;

/** 자격이 설정되지 않은 환경. 호출자는 일반 공급자 실패처럼 폴백·WEATHER_1901로 처리한다. */
export class WeatherKitNotConfiguredError extends Error {
  constructor() {
    super("WeatherKit credentials are not configured");
    this.name = "WeatherKitNotConfiguredError";
  }
}

interface SignedToken {
  readonly token: string;
  readonly refreshAtMs: number;
}

/** WeatherKit REST용 ES256 개발자 토큰. 토큰 하나만 메모리에 두고 동시 서명은 한 번으로 묶는다. */
@Injectable()
export class WeatherKitTokenResolver {
  readonly #logger = new Logger(WeatherKitTokenResolver.name);
  #current: SignedToken | null = null;
  #signing: Promise<string> | null = null;

  constructor(
    @Inject(TypedConfigService)
    private readonly configService: Pick<TypedConfigService, "weatherKit">,
  ) {}

  resolve(): Promise<string> {
    if (this.#current != null && Date.now() < this.#current.refreshAtMs) {
      return Promise.resolve(this.#current.token);
    }
    this.#signing ??= this.#sign().finally(() => {
      this.#signing = null;
    });
    return this.#signing;
  }

  async #sign(): Promise<string> {
    const credentials = this.configService.weatherKit;
    if (credentials == null) {
      throw new WeatherKitNotConfiguredError();
    }

    const key = await importPKCS8(credentials.privateKey, "ES256");
    const issuedAtSeconds = Math.floor(Date.now() / 1000);
    const expiresAtSeconds = issuedAtSeconds + TOKEN_LIFETIME_SECONDS;
    const token = await new SignJWT({})
      .setProtectedHeader({
        alg: "ES256",
        kid: credentials.keyId,
        id: `${credentials.teamId}.${credentials.serviceId}`,
      })
      .setIssuer(credentials.teamId)
      .setSubject(credentials.serviceId)
      .setIssuedAt(issuedAtSeconds)
      .setExpirationTime(expiresAtSeconds)
      .sign(key);

    this.#current = { token, refreshAtMs: expiresAtSeconds * 1000 - REFRESH_MARGIN_MS };
    this.#logger.debug({
      event: WeatherKitLogEvent.TOKEN_SIGNED,
      expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
    });
    return token;
  }
}
