import { Inject, Injectable, Logger } from "@nestjs/common";
import { importPKCS8, SignJWT } from "jose";

import { ClockPort } from "#api/shared/application/ports/clock.port";

import {
  weatherWeatherReportsConfig,
  type WeatherWeatherReportsConfig,
} from "../../weather-weather-reports.config.js";
import { WeatherKitNotConfiguredError } from "./weatherkit.errors.js";
import { WeatherKitLogEvent } from "./weatherkit.log-events.js";

const TOKEN_LIFETIME_SECONDS = 60 * 60;
/** 만료 직전 토큰이 요청 도중 만료되지 않도록 5분 일찍 새로 서명한다. */
const REFRESH_MARGIN_MS = 5 * 60_000;

interface SignedToken {
  readonly token: string;
  readonly refreshAtMs: number;
}

/** WeatherKit REST용 ES256 개발자 토큰. 토큰 하나만 메모리에 두고 동시 서명은 한 번으로 묶는다. */
@Injectable()
export class WeatherKitTokenAdapter {
  readonly #logger = new Logger(WeatherKitTokenAdapter.name);
  #current: SignedToken | null = null;
  #signing: Promise<string> | null = null;
  readonly #config: Pick<WeatherWeatherReportsConfig, "weatherKit">;
  readonly #clock: ClockPort;

  constructor(
    @Inject(weatherWeatherReportsConfig.KEY) config: Pick<
      WeatherWeatherReportsConfig,
      "weatherKit"
    >,
    clock: ClockPort,
  ) {
    this.#config = config;
    this.#clock = clock;
  }

  resolve(): Promise<string> {
    if (this.#current != null && this.#clock.now().epochMilliseconds < this.#current.refreshAtMs) {
      return Promise.resolve(this.#current.token);
    }
    this.#signing ??= this.#sign().finally(() => {
      this.#signing = null;
    });
    return this.#signing;
  }

  /** 공급자가 토큰을 거절했을 때 다음 resolve가 새로 서명하게 한다. */
  invalidate(): void {
    this.#current = null;
  }

  async #sign(): Promise<string> {
    const credentials = this.#config.weatherKit;
    if (credentials == null) {
      throw new WeatherKitNotConfiguredError();
    }

    const key = await importPKCS8(credentials.privateKey, "ES256");
    const issuedAtSeconds = Math.floor(this.#clock.now().epochMilliseconds / 1000);
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
