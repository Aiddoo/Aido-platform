import { ErrorCode } from "@aido/api/errors";
import type { OAUTH_PROVIDERS } from "@aido/api/vocabulary";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { IdentityLogEvent } from "../../observability/auth/identity-log.events.js";
import type { AuthRuntimeConfigPort } from "../../ports/auth/auth-collaboration.port.js";
import type { AuthOAuthStateRepositoryPort } from "../../ports/auth/auth-persistence.port.js";
import type {
  OAuthIdentityProviderRegistry,
  OAuthMode,
} from "../../ports/auth/oauth-identity-provider.port.js";

export interface StartOAuthAuthorizationInput {
  readonly provider: Exclude<(typeof OAUTH_PROVIDERS)[number], "APPLE">;
  readonly state: string;
  readonly clientRedirectUri?: string;
  readonly mode?: OAuthMode;
  readonly initiatingUserId?: string;
}

interface StartOAuthAuthorizationDependencies {
  readonly registry: OAuthIdentityProviderRegistry;
  readonly oauthStateRepository: Pick<AuthOAuthStateRepositoryPort, "create">;
  readonly configService: Pick<AuthRuntimeConfigPort, "isDevelopment">;
  readonly logger: ApplicationLogger;
}

export class StartOAuthAuthorization {
  readonly #dependencies: StartOAuthAuthorizationDependencies;

  constructor(dependencies: StartOAuthAuthorizationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: StartOAuthAuthorizationInput): Promise<string> {
    const strategy = this.#dependencies.registry.get(input.provider);
    if (strategy === undefined)
      throw new ApplicationException(ErrorCode.SOCIAL_0204, {
        provider: input.provider,
        reason: `Unsupported provider: ${input.provider}`,
      });
    const url = await strategy.generateAuthUrl({
      state: input.state,
      validatedRedirectUri: this.#resolveRedirectUri(input.clientRedirectUri),
      mode: input.mode,
      initiatingUserId: input.initiatingUserId,
      persistState: (provider, redirectUri, options) =>
        this.#dependencies.oauthStateRepository.create(input.state, provider, redirectUri, options),
    });
    if (url === null || url === "") throw new ApplicationException(ErrorCode.USER_0602);
    return url;
  }

  #resolveRedirectUri(redirectUri?: string): string {
    const defaultRedirectUri = "aido://auth/callback";
    if (redirectUri === undefined || redirectUri === "") return defaultRedirectUri;
    const patterns = [
      /^aido:\/\/auth(\/.*)?$/,
      /^aido:\/\/\/auth(\/.*)?$/,
      /^https:\/\/aido\.kr(\/.*)?$/,
      /^https:\/\/(api|www|app)\.aido\.kr(\/.*)?$/,
    ];
    if (this.#dependencies.configService.isDevelopment)
      patterns.push(
        /^aido-dev:\/\/auth(\/.*)?$/,
        /^aido-dev:\/\/\/auth(\/.*)?$/,
        /^http:\/\/localhost(:\d+)?(\/.*)?$/,
        /^exp:\/\/[\d.:]+(\/.*)?$/,
      );
    if (patterns.some((pattern) => pattern.test(redirectUri))) return redirectUri;
    this.#dependencies.logger.warn({ event: IdentityLogEvent.OAUTH_REDIRECT_REJECTED });
    return defaultRedirectUri;
  }
}
