import { Module } from "@nestjs/common";

import { IdentityLinkedAccountsModule } from "../linked-accounts/identity-linked-accounts.module.js";
import { IdentitySessionsModule } from "../sessions/identity-sessions.module.js";
import { IdentityUsersQueriesModule } from "../users/identity-users-queries.module.js";
import { IdentityUsersModule } from "../users/identity-users.module.js";
import { IdentityOAuthStatesQueriesModule } from "./identity-oauth-states-queries.module.js";
import { IDENTITY_OAUTH_STATES_PROVIDERS } from "./identity-oauth-states.providers.js";
import { OAuthController } from "./presentation/http/v1/oauth.controller.js";

// 웹 OAuth 콜백이 소셜 토큰 로그인(sessions)·계정 연결(linked-accounts)·가입 알림(users)을 부른다
@Module({
  imports: [
    IdentityOAuthStatesQueriesModule,
    IdentityUsersQueriesModule,
    IdentityUsersModule,
    IdentityLinkedAccountsModule,
    IdentitySessionsModule,
  ],
  controllers: [OAuthController],
  providers: [...IDENTITY_OAUTH_STATES_PROVIDERS],
})
export class IdentityOAuthStatesModule {}
