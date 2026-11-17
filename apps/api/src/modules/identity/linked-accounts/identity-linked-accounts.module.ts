import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HttpClientModule } from "@nestjs/http-client";

import { IdentitySessionsQueriesModule } from "../sessions/identity-sessions-queries.module.js";
import { IdentityUsersQueriesModule } from "../users/identity-users-queries.module.js";
import { IdentityVerificationsModule } from "../verifications/identity-verifications.module.js";
import { LinkedAccountsRepositoryPort } from "./application/ports/linked-accounts.repository.port.js";
import { OAuthIdentityProviderRegistryPort } from "./application/ports/oauth-identity-provider.port.js";
import { PasswordHasherPort } from "./application/ports/password-hasher.port.js";
import { LinkOAuthIdentityUseCase } from "./application/use-cases/link-oauth-identity.use-case.js";
import { identityLinkedAccountsConfig } from "./identity-linked-accounts.config.js";
import { IDENTITY_LINKED_ACCOUNTS_PROVIDERS } from "./identity-linked-accounts.providers.js";
import { OAUTH_PROVIDER_TIMEOUT_MS } from "./infrastructure/adapters/oauth-outbound.policy.js";
import { LinkedAccountController } from "./presentation/http/v1/linked-account.controller.js";
import { PasswordController } from "./presentation/http/v1/password.controller.js";
import { SocialAccountLinkController } from "./presentation/http/v1/social-account-link.controller.js";

// 가입(users)·로그인(sessions)·웹 OAuth(oauth-states)가 로그인 수단 저장소·비밀번호 hash·공급자 검증을 쓴다
@Module({
  imports: [
    ConfigModule.forFeature(identityLinkedAccountsConfig),
    HttpClientModule.register({
      name: "oauth",
      retry: false,
      throwOnHttpError: false,
      timeout: OAUTH_PROVIDER_TIMEOUT_MS,
    }),
    IdentityUsersQueriesModule,
    IdentitySessionsQueriesModule,
    IdentityVerificationsModule,
  ],
  controllers: [LinkedAccountController, SocialAccountLinkController, PasswordController],
  providers: [...IDENTITY_LINKED_ACCOUNTS_PROVIDERS],
  exports: [
    LinkedAccountsRepositoryPort,
    PasswordHasherPort,
    OAuthIdentityProviderRegistryPort,
    LinkOAuthIdentityUseCase,
  ],
})
export class IdentityLinkedAccountsModule {}
