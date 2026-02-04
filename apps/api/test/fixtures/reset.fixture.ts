/**
 * Fixture 리셋 유틸리티
 *
 * 모든 Fixture 카운터를 리셋하는 함수를 별도 파일로 분리하여
 * index.ts의 순환 참조 문제를 방지하고 구조를 명확하게 유지
 */

import { CheerFixture, FollowFixture, NudgeFixture } from "./friend.fixture";
import { NotificationFixture, PushTokenFixture } from "./notification.fixture";
import { SessionFixture, VerificationFixture } from "./session.fixture";
import { TodoCategoryFixture, TodoFixture } from "./todo.fixture";
import { AccountFixture, UserFixture } from "./user.fixture";

/**
 * 모든 Fixture 카운터 리셋
 *
 * Jest의 afterAll 또는 afterEach에서 호출하여
 * 테스트 간 격리를 보장
 *
 * @example
 * ```typescript
 * afterAll(() => {
 *   resetAllFixtures();
 * });
 * ```
 */
export function resetAllFixtures(): void {
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
