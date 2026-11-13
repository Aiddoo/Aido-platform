import type { OAUTH_PROVIDERS } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { OAUTH_STATE_EXPIRY_MINUTES, type OAuthMode } from "../../domain/auth.constants.js";
import { invalidCredentials, unsupportedOAuthProvider } from "../auth.errors.js";
import { AuthLogEvent } from "../auth.log-events.js";
import type { AuthRuntimeConfigPort } from "../ports/auth-collaboration.port.js";
import type { AuthOAuthStateRepositoryPort } from "../ports/auth-oauth-state.repository.port.js";
import type { OAuthIdentityProviderRegistryPort } from "../ports/oauth-identity-provider.port.js";

export interface StartOAuthAuthorizationCommand {
  readonly provider: Exclude<(typeof OAUTH_PROVIDERS)[number], "APPLE">;
  readonly state: string;
  readonly clientRedirectUri?: string;
  readonly mode?: OAuthMode;
  readonly initiatingUserId?: string;
}

interface StartOAuthAuthorizationDependencies {
  readonly registry: Pick<OAuthIdentityProviderRegistryPort, "get">;
  readonly oauthStateRepository: Pick<AuthOAuthStateRepositoryPort, "create">;
  readonly configService: Pick<AuthRuntimeConfigPort, "allowsDevRedirects">;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
}

export class StartOAuthAuthorizationUseCase {
  readonly #dependencies: StartOAuthAuthorizationDependencies;

  constructor(dependencies: StartOAuthAuthorizationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: StartOAuthAuthorizationCommand): Promise<string> {
    const strategy = this.#dependencies.registry.get(input.provider);
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
    const defaultRedirectUri = "aido://auth/callback";
    if (redirectUri == null || redirectUri === "") {
      return defaultRedirectUri;
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
    this.#dependencies.logger.warn({ event: AuthLogEvent.OAUTH_REDIRECT_REJECTED });
    return defaultRedirectUri;
  }
}
