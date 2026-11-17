import type { FactoryProvider, Provider } from "@nestjs/common";

import { appConfig, type AppSettings } from "#api/platform/config/app.config";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { OAuthIdentityProviderRegistryPort } from "../linked-accounts/application/ports/oauth-identity-provider.port.js";
import { LinkOAuthIdentityUseCase } from "../linked-accounts/application/use-cases/link-oauth-identity.use-case.js";
import { LoginWithOAuthTokenUseCase } from "../sessions/application/use-cases/login-with-oauth-token.use-case.js";
import { UserMutationLockPort } from "../users/application/ports/user-mutation-lock.port.js";
import { UserProfileInvalidatorPort } from "../users/application/ports/user-profile-invalidator.port.js";
import { NotifyOAuthSignupUseCase } from "../users/application/use-cases/notify-oauth-signup.use-case.js";
import { OAuthRuntimeConfigPort } from "./application/ports/oauth-runtime-config.port.js";
import { OAuthStateRepositoryPort } from "./application/ports/oauth-state.repository.port.js";
import { CompleteOAuthAuthorizationUseCase } from "./application/use-cases/complete-oauth-authorization.use-case.js";
import { ExchangeOAuthCodeUseCase } from "./application/use-cases/exchange-oauth-code.use-case.js";
import { GetOAuthRedirectUriUseCase } from "./application/use-cases/get-oauth-redirect-uri.use-case.js";
import { LinkOAuthAccountWithCodeUseCase } from "./application/use-cases/link-oauth-account-with-code.use-case.js";
import { StartOAuthAuthorizationUseCase } from "./application/use-cases/start-oauth-authorization.use-case.js";
import { DrizzleOAuthStateRepository } from "./infrastructure/persistence/drizzle-oauth-state.repository.js";

const oauthRuntimeConfigProvider: FactoryProvider<OAuthRuntimeConfigPort> = {
  provide: OAuthRuntimeConfigPort,
  inject: [appConfig.KEY],
  useFactory: (app: AppSettings): OAuthRuntimeConfigPort => ({
    allowsDevRedirects: app.devTools.oauthDevRedirects,
  }),
};

export const getOAuthRedirectUriProvider = provideUseCase(GetOAuthRedirectUriUseCase, {
  oauthStateRepository: OAuthStateRepositoryPort,
  clock: ClockPort,
});

export const startOAuthAuthorizationProvider = provideUseCase(StartOAuthAuthorizationUseCase, {
  registry: OAuthIdentityProviderRegistryPort,
  oauthStateRepository: OAuthStateRepositoryPort,
  configService: OAuthRuntimeConfigPort,
  clock: ClockPort,
  logger: loggerFor(StartOAuthAuthorizationUseCase),
});

export const completeOAuthAuthorizationProvider = provideUseCase(
  CompleteOAuthAuthorizationUseCase,
  {
    registry: OAuthIdentityProviderRegistryPort,
    oauthStateRepository: OAuthStateRepositoryPort,
    loginWithOAuthToken: LoginWithOAuthTokenUseCase,
    clock: ClockPort,
    logger: loggerFor(CompleteOAuthAuthorizationUseCase),
  },
);

export const exchangeOAuthCodeProvider = provideUseCase(ExchangeOAuthCodeUseCase, {
  oauthStateRepository: OAuthStateRepositoryPort,
  oauthSignupNotifier: NotifyOAuthSignupUseCase,
  clock: ClockPort,
  logger: loggerFor(ExchangeOAuthCodeUseCase),
});

export const linkOAuthAccountWithCodeProvider = provideUseCase(LinkOAuthAccountWithCodeUseCase, {
  userMutationLock: UserMutationLockPort,
  oauthStateRepository: OAuthStateRepositoryPort,
  linkOAuthIdentity: LinkOAuthIdentityUseCase,
  unitOfWork: UnitOfWorkPort,
  cacheService: UserProfileInvalidatorPort,
  clock: ClockPort,
  logger: loggerFor(LinkOAuthAccountWithCodeUseCase),
});

export const IDENTITY_OAUTH_STATES_PROVIDERS = [
  { provide: OAuthStateRepositoryPort, useClass: DrizzleOAuthStateRepository },
  oauthRuntimeConfigProvider,
  getOAuthRedirectUriProvider,
  startOAuthAuthorizationProvider,
  completeOAuthAuthorizationProvider,
  exchangeOAuthCodeProvider,
  linkOAuthAccountWithCodeProvider,
] satisfies Provider[];
