import { Module } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";

import { AccessFeatureGrantsQueriesModule } from "#api/modules/access/feature-grants/access-feature-grants-queries.public";
import { NotificationPushDevicesQueriesModule } from "#api/modules/notification/push-devices/notification-push-devices.public";
import { jwtConfig } from "#api/platform/config/jwt.config";

import { IdentityLinkedAccountsModule } from "../linked-accounts/identity-linked-accounts.module.js";
import { IdentityUsersQueriesModule } from "../users/identity-users-queries.module.js";
import { IdentityUsersModule } from "../users/identity-users.module.js";
import { IdentityVerificationsModule } from "../verifications/identity-verifications.module.js";
import { LoginWithOAuthTokenUseCase } from "./application/use-cases/login-with-oauth-token.use-case.js";
import { IdentitySessionsQueriesModule } from "./identity-sessions-queries.module.js";
import { IDENTITY_SESSIONS_PROVIDERS } from "./identity-sessions.providers.js";
import { JwtAuthGuard } from "./presentation/http/guards/jwt-auth.guard.js";
import { JwtRefreshGuard } from "./presentation/http/guards/jwt-refresh.guard.js";
import { LoginController } from "./presentation/http/v1/login.controller.js";
import { MobileOAuthLoginController } from "./presentation/http/v1/mobile-oauth-login.controller.js";
import { SessionController } from "./presentation/http/v1/session.controller.js";

// 로그인은 가입·복구(users)·로그인 수단(linked-accounts)·인증 코드(verifications)를 모아 세션을 만든다.
// 웹 OAuth(oauth-states)가 소셜 토큰 로그인 UseCase를 쓰고, 앱 전역 가드가 JwtAuthGuard를 쓴다
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [jwtConfig.KEY],
      useFactory: (jwt: ConfigType<typeof jwtConfig>) => ({ secret: jwt.secret }),
    }),
    IdentityUsersQueriesModule,
    IdentitySessionsQueriesModule,
    IdentityUsersModule,
    IdentityLinkedAccountsModule,
    IdentityVerificationsModule,
    AccessFeatureGrantsQueriesModule,
    NotificationPushDevicesQueriesModule,
  ],
  controllers: [LoginController, MobileOAuthLoginController, SessionController],
  providers: [...IDENTITY_SESSIONS_PROVIDERS, JwtAuthGuard, JwtRefreshGuard],
  exports: [JwtAuthGuard, LoginWithOAuthTokenUseCase],
})
export class IdentitySessionsModule {}
