import type { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";

import type { RequestDevice } from "../../../shared/domain/request-metadata.constants.js";
import type { NotifyOAuthSignupUseCase } from "../../../users/application/use-cases/notify-oauth-signup.use-case.js";
import { invalidCredentials } from "../../../users/application/users.errors.js";
import { OAuthStateLogEvent } from "../oauth-states.log-events.js";
import type { OAuthStateRepositoryPort } from "../ports/oauth-state.repository.port.js";
import type { ExchangeCodeResult } from "../read-models/oauth-exchange.read-model.js";

export interface ExchangeOAuthCodeCommand {
  readonly code: string;
  readonly device?: RequestDevice;
}

interface ExchangeOAuthCodeDependencies {
  readonly oauthStateRepository: Pick<
    OAuthStateRepositoryPort,
    "findByExchangeCode" | "consumeExchangeCode"
  >;
  readonly oauthSignupNotifier: Pick<NotifyOAuthSignupUseCase, "notify">;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
}

export class ExchangeOAuthCodeUseCase {
  readonly #dependencies: ExchangeOAuthCodeDependencies;

  constructor(dependencies: ExchangeOAuthCodeDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ExchangeOAuthCodeCommand): Promise<ExchangeCodeResult> {
    const at = this.#dependencies.clock.now();
    const state = await this.#dependencies.oauthStateRepository.findByExchangeCode(input.code, at);
    if (state == null || state.validityAt(at) !== "valid") {
      throw this.#invalidCode();
    }
    const exchange = state.loginExchange();
    if (exchange == null) {
      throw this.#invalidCode();
    }
    const { accessToken, refreshToken, userId } = exchange;
    // 저장한 토큰을 먼저 꺼낸 뒤 소비한다. 소비하면 토큰 칸을 비운다
    if (!state.consume(at)) {
      throw this.#invalidCode();
    }
    const consumed = await this.#dependencies.oauthStateRepository.consumeExchangeCode({
      id: state.id,
      exchangeCode: input.code,
      at,
      purpose: "login",
    });
    if (!consumed) {
      throw this.#invalidCode();
    }
    this.#dependencies.logger.debug({ event: OAuthStateLogEvent.OAUTH_EXCHANGE_CONSUMED, userId });
    // 웹 콜백은 시스템 브라우저 요청이라 앱 버전·기기가 없다. 코드는 일회용이라 알림도 한 번만 나간다.
    if (state.isNewUser === true) {
      await this.#dependencies.oauthSignupNotifier.notify({
        userId,
        provider: state.provider,
        device: input.device,
      });
    }
    return {
      accessToken,
      refreshToken,
      userId,
      userName: state.userName ?? undefined,
      profileImage: state.profileImage ?? undefined,
      accountRestored: state.accountRestored ?? undefined,
      isNewUser: state.isNewUser ?? false,
    };
  }

  #invalidCode(): ApplicationException {
    this.#dependencies.logger.warn({
      event: OAuthStateLogEvent.OAUTH_EXCHANGE_REJECTED,
      mode: "login",
    });
    return invalidCredentials();
  }
}
