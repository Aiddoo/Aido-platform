import { Module } from "@nestjs/common";

import { LoginAttemptRepositoryPort } from "./application/ports/login-attempt.repository.port.js";
import { SessionCachePort } from "./application/ports/session-cache.port.js";
import { SessionRepositoryPort } from "./application/ports/session.repository.port.js";
import { SessionCacheAdapter } from "./infrastructure/adapters/session-cache.adapter.js";
import { DrizzleLoginAttemptRepository } from "./infrastructure/persistence/drizzle-login-attempt.repository.js";
import { DrizzleSessionRepository } from "./infrastructure/persistence/drizzle-session.repository.js";

// 탈퇴(users)·비밀번호 변경과 재설정(linked-accounts)이 같은 트랜잭션에서 세션을 폐기한다. 세션 기능 Module은
// 가입·복구 UseCase 때문에 users·linked-accounts Module을 import하므로 폐기 포트는 그 아래층인 여기에 둔다.
// 보관 기한 정리(users)도 세션·로그인 시도 저장소를 여기서 받는다
@Module({
  providers: [
    { provide: SessionRepositoryPort, useClass: DrizzleSessionRepository },
    { provide: LoginAttemptRepositoryPort, useClass: DrizzleLoginAttemptRepository },
    { provide: SessionCachePort, useClass: SessionCacheAdapter },
  ],
  exports: [SessionRepositoryPort, LoginAttemptRepositoryPort, SessionCachePort],
})
export class IdentitySessionsQueriesModule {}
