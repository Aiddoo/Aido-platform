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
export { CheerFixture, FollowFixture, NudgeFixture } from "./friend.fixture";
// Notification 관련
export { NotificationFixture, PushTokenFixture } from "./notification.fixture";

// Session/Auth 관련
export { SessionFixture, VerificationFixture } from "./session.fixture";
// Todo 관련
export { TodoCategoryFixture, TodoFixture } from "./todo.fixture";
// User 관련
export { AccountFixture, UserFixture } from "./user.fixture";

/**
 * 모든 Fixture 카운터 리셋
 *
 * Jest의 afterAll 또는 afterEach에서 호출
 *
 * @example
 * ```typescript
 * afterAll(() => {
 *   resetAllFixtures();
 * });
 * ```
 */
export function resetAllFixtures(): void {
	// 동적 import를 피하기 위해 각 fixture를 직접 import하여 reset
	const { UserFixture, AccountFixture } = require("./user.fixture");
	const { TodoFixture, TodoCategoryFixture } = require("./todo.fixture");
	const { SessionFixture, VerificationFixture } = require("./session.fixture");
	const {
		NotificationFixture,
		PushTokenFixture,
	} = require("./notification.fixture");
	const {
		FollowFixture,
		NudgeFixture,
		CheerFixture,
	} = require("./friend.fixture");

	UserFixture.reset();
	AccountFixture.reset();
	TodoFixture.reset();
	TodoCategoryFixture.reset();
	SessionFixture.reset();
	VerificationFixture.reset();
	NotificationFixture.reset();
	PushTokenFixture.reset();
	FollowFixture.reset();
	NudgeFixture.reset();
	CheerFixture.reset();
}
