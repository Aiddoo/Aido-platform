import { Module } from "@nestjs/common";

import { OAuthStateRepositoryPort } from "./application/ports/oauth-state.repository.port.js";
import { DrizzleOAuthStateRepository } from "./infrastructure/persistence/drizzle-oauth-state.repository.js";

// 보관 기한 정리(users)가 state를 지운다. 웹 OAuth 기능 Module은 users Module을 import하므로 저장소는 그 아래층인 여기에 둔다
@Module({
  providers: [{ provide: OAuthStateRepositoryPort, useClass: DrizzleOAuthStateRepository }],
  exports: [OAuthStateRepositoryPort],
})
export class IdentityOAuthStatesQueriesModule {}
