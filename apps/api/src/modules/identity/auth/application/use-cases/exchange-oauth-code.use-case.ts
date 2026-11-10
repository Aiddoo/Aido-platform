import { ErrorCode } from "@aido/api/errors";

import { AuthOAuthState } from "#api/modules/identity/auth/domain/auth-oauth-state.aggregate";
import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { now } from "#api/shared/domain/date/utils/core";

import { AuthLogEvent } from "../auth.log-events.js";
import type { AuthOAuthStateRepositoryPort } from "../ports/auth-persistence.port.js";
import type { ExchangeCodeResult, RequestDevice } from "../read-models/auth-result.read-model.js";
import type { NotifyOAuthSignupUseCase } from "./notify-oauth-signup.use-case.js";

export interface ExchangeOAuthCodeCommand {
  readonly code: string;
  readonly device?: RequestDevice;
}

interface ExchangeOAuthCodeDependencies {
  readonly oauthStateRepository: Pick<
    AuthOAuthStateRepositoryPort,
    "findByExchangeCode" | "consumeExchangeCode"
  >;
  readonly oauthSignupNotifier: Pick<NotifyOAuthSignupUseCase, "notify">;
  readonly logger: ApplicationLoggerPort;
}

export class ExchangeOAuthCodeUseCase {
  readonly #dependencies: ExchangeOAuthCodeDependencies;

  constructor(dependencies: ExchangeOAuthCodeDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ExchangeOAuthCodeCommand): Promise<ExchangeCodeResult> {
    const at = now();
    const state = await this.#dependencies.oauthStateRepository.findByExchangeCode(input.code, at);
    if (state == null) {
      throw this.#invalidCode();
    }
    const authorization = AuthOAuthState.reconstitute(state);
    if (authorization.validityAt(at) !== "valid") {
      throw this.#invalidCode();
    }
    const { accessToken, refreshToken, userId } = state;
    if (
      accessToken == null ||
      accessToken === "" ||
      refreshToken == null ||
      refreshToken === "" ||
      userId == null ||
      userId === ""
    ) {
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
    authorization.consume(at);
    this.#dependencies.logger.debug({ event: AuthLogEvent.OAUTH_EXCHANGE_CONSUMED, userId });
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
      event: AuthLogEvent.OAUTH_EXCHANGE_REJECTED,
      mode: "login",
    });
    return new ApplicationException(ErrorCode.USER_0602);
  }
}
