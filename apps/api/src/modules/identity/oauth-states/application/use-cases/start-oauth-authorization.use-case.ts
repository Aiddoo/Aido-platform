import type { OAUTH_PROVIDERS } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { unsupportedOAuthProvider } from "../../../linked-accounts/application/linked-accounts.errors.js";
import type { OAuthIdentityProviderRegistryPort } from "../../../linked-accounts/application/ports/oauth-identity-provider.port.js";
import { invalidCredentials } from "../../../users/application/users.errors.js";
import {
  DEFAULT_OAUTH_REDIRECT_URI,
  OAUTH_STATE_EXPIRY_MINUTES,
  type OAuthMode,
} from "../../domain/oauth-states.constants.js";
import { OAuthStateLogEvent } from "../oauth-states.log-events.js";
import type { OAuthRuntimeConfigPort } from "../ports/oauth-runtime-config.port.js";
import type { OAuthStateRepositoryPort } from "../ports/oauth-state.repository.port.js";

export interface StartOAuthAuthorizationCommand {
  readonly provider: Exclude<(typeof OAUTH_PROVIDERS)[number], "APPLE">;
  readonly state: string;
  readonly clientRedirectUri?: string;
  readonly mode?: OAuthMode;
  readonly initiatingUserId?: string;
}

interface StartOAuthAuthorizationDependencies {
  readonly registry: Pick<OAuthIdentityProviderRegistryPort, "find">;
  readonly oauthStateRepository: Pick<OAuthStateRepositoryPort, "create">;
  readonly configService: Pick<OAuthRuntimeConfigPort, "allowsDevRedirects">;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
}

export class StartOAuthAuthorizationUseCase {
  readonly #dependencies: StartOAuthAuthorizationDependencies;

  constructor(dependencies: StartOAuthAuthorizationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: StartOAuthAuthorizationCommand): Promise<string> {
    const strategy = this.#dependencies.registry.find(input.provider);
    if (strategy == null) {
      throw unsupportedOAuthProvider(input.provider);
    }
    const url = await strategy.generateAuthUrl({
      state: input.state,
      validatedRedirectUri: this.#resolveRedirectUri(input.clientRedirectUri),
      mode: input.mode,
      initiatingUserId:
        input.initiatingUserId == null ? undefined : UserId.reconstitute(input.initiatingUserId),
      persistState: (provider, redirectUri, options) =>
        this.#dependencies.oauthStateRepository.create({
          state: input.state,
          provider,
          redirectUri,
          mode: options.mode,
          initiatingUserId: options.initiatingUserId,
          expiresAt: this.#dependencies.clock.now().add({ minutes: OAUTH_STATE_EXPIRY_MINUTES }),
        }),
    });
    if (url == null || url === "") {
      throw invalidCredentials();
    }
    return url;
  }

  #resolveRedirectUri(redirectUri?: string): string {
    if (redirectUri == null || redirectUri === "") {
      return DEFAULT_OAUTH_REDIRECT_URI;
    }
    const patterns = [
      /^aido:\/\/auth(\/.*)?$/,
      /^aido:\/\/\/auth(\/.*)?$/,
      /^https:\/\/aido\.kr(\/.*)?$/,
      /^https:\/\/(api|www|app)\.aido\.kr(\/.*)?$/,
    ];
    if (this.#dependencies.configService.allowsDevRedirects) {
      patterns.push(
        /^aido-dev:\/\/auth(\/.*)?$/,
        /^aido-dev:\/\/\/auth(\/.*)?$/,
        /^http:\/\/localhost(:\d+)?(\/.*)?$/,
        /^exp:\/\/[\d.:]+(\/.*)?$/,
      );
    }
    if (patterns.some((pattern) => pattern.test(redirectUri))) {
      return redirectUri;
    }
    this.#dependencies.logger.warn({ event: OAuthStateLogEvent.OAUTH_REDIRECT_REJECTED });
    return DEFAULT_OAUTH_REDIRECT_URI;
  }
}
