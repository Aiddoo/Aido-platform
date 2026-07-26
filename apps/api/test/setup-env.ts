/**
 * E2E 테스트 런타임 설정
 *
 * Jest가 테스트 파일을 로드하기 전에 실행됨.
 * 환경변수는 .env.test 파일에서 관리 — 여기서는 런타임 패치만 수행.
 */
import "../src/shared/domain/date/dayjs.setup";
import { bypassE2eThrottler } from "./e2e/helpers/e2e-throttler-control";

/**
 * E2E 테스트에서 rate limiting 비활성화
 *
 * @nestjs/throttler v6의 ThrottlerGuard는 APP_GUARD로 등록되어
 * overrideGuard/overrideProvider로 비활성화할 수 없음.
 * 프로토타입 패치가 유일한 방법.
 *
 * @see https://github.com/nestjs/throttler/issues
 */
bypassE2eThrottler();

// NODE_ENV=test 보장 (.env.test 로드 전에 설정되어야 config.module.ts가 올바른 파일 선택)
process.env.NODE_ENV = "test";
