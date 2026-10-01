/**
 * Test Fixtures
 *
 * 모든 테스트 Fixture를 통합 export
 *
 * @example
 * ```typescript
 * import { UserFixture, TodoFixture, SessionFixture } from '@test/fixtures';
 *
 * const user = UserFixture.create();
 * const todo = TodoFixture.create({ userId: user.id });
 * ```
 */

// Friend/Social 관련
export { CheerFixture, FollowFixture, NudgeFixture } from "./friend.fixture.js";
// Prisma CUID 계약용 고정 ID
export { TEST_CUID } from "./id.fixture.js";
// Notification 관련
export { NotificationFixture, PushTokenFixture } from "./notification.fixture.js";
// 리셋 유틸리티
export { resetAllFixtures } from "./reset.fixture.js";
// Session/Auth 관련
export { SessionFixture, VerificationFixture } from "./session.fixture.js";
// Todo 관련
export { TodoCategoryFixture, TodoFixture } from "./todo.fixture.js";
// User 관련
export { AccountFixture, UserFixture } from "./user.fixture.js";
