import type { SubscriptionUserReaderPort } from "#api/modules/billing/subscriptions/application/ports/subscription-user.reader.port";
import type { SubscriptionUserReadModel } from "#api/modules/billing/subscriptions/application/read-models/subscription-user.read-model";
import {
  SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
  SUBSCRIPTION_FIXTURE_USER_ID,
} from "#test/fixtures/billing/subscription.fixture";

interface SeedSubscriptionUserInput {
  readonly id: string;
  readonly email: string;
  /** null이면 프로필 행이 없다 */
  readonly name: string | null;
  /** User.id와 다른 RevenueCat 별칭 */
  readonly appUserAlias?: string;
}

export interface SubscriptionUserReaderHarness {
  readonly reader: SubscriptionUserReaderPort;
  seedUser(input: SeedSubscriptionUserInput): Promise<void>;
}

function primitivesOf(user: SubscriptionUserReadModel | null | undefined) {
  return user == null ? null : { id: user.id.value, email: user.email, name: user.name };
}

export function describeSubscriptionUserReaderContract(
  createHarness: () => Promise<SubscriptionUserReaderHarness>,
): void {
  describe("구독 사용자 reader 계약", () => {
    it("앱 사용자 ID가 User.id이면 그 사용자를 찾는다", async () => {
      // Given
      const { reader, seedUser } = await createHarness();
      await seedUser({
        id: SUBSCRIPTION_FIXTURE_USER_ID,
        email: "owner@example.com",
        name: "소유자",
      });

      // When
      const found = await reader.findFirstByAppUserIds([SUBSCRIPTION_FIXTURE_USER_ID]);

      // Then
      expect(primitivesOf(found)).toEqual({
        id: SUBSCRIPTION_FIXTURE_USER_ID,
        email: "owner@example.com",
        name: "소유자",
      });
    });

    it("RevenueCat 별칭으로도 같은 사용자를 찾는다", async () => {
      // Given
      const { reader, seedUser } = await createHarness();
      await seedUser({
        id: SUBSCRIPTION_FIXTURE_USER_ID,
        email: "owner@example.com",
        name: "소유자",
        appUserAlias: "owner-alias",
      });
      await seedUser({
        id: SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
        email: "other@example.com",
        name: null,
      });

      // When
      const found = await reader.findFirstByAppUserIds(["owner-alias"]);

      // Then
      expect(found?.id.value).toBe(SUBSCRIPTION_FIXTURE_USER_ID);
    });

    it("프로필이 없는 사용자도 찾고 이름은 null이다", async () => {
      // Given
      const { reader, seedUser } = await createHarness();
      await seedUser({ id: SUBSCRIPTION_FIXTURE_USER_ID, email: "owner@example.com", name: null });

      // When
      const found = await reader.findFirstByAppUserIds([SUBSCRIPTION_FIXTURE_USER_ID]);

      // Then
      expect(primitivesOf(found)).toMatchObject({ id: SUBSCRIPTION_FIXTURE_USER_ID, name: null });
    });

    it("모르는 앱 사용자 ID만 있으면 null이다", async () => {
      // Given
      const { reader, seedUser } = await createHarness();
      await seedUser({
        id: SUBSCRIPTION_FIXTURE_USER_ID,
        email: "owner@example.com",
        name: "소유자",
      });

      // When
      const found = await reader.findFirstByAppUserIds(["unknown-app-user"]);

      // Then
      expect(found).toBeNull();
    });

    it("여러 ID 중 우리 사용자로 이어지는 앞선 ID의 사용자를 고른다", async () => {
      // Given
      const { reader, seedUser } = await createHarness();
      await seedUser({
        id: SUBSCRIPTION_FIXTURE_USER_ID,
        email: "owner@example.com",
        name: "소유자",
      });
      await seedUser({
        id: SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
        email: "other@example.com",
        name: null,
        appUserAlias: "other-alias",
      });

      // When
      const found = await reader.findFirstByAppUserIds([
        "unknown-app-user",
        "other-alias",
        SUBSCRIPTION_FIXTURE_USER_ID,
      ]);

      // Then
      expect(found?.id.value).toBe(SUBSCRIPTION_FIXTURE_OTHER_USER_ID);
    });

    it("목록은 앞선 ID 순으로 주고 같은 사용자는 한 번만 준다", async () => {
      // Given
      const { reader, seedUser } = await createHarness();
      await seedUser({
        id: SUBSCRIPTION_FIXTURE_USER_ID,
        email: "owner@example.com",
        name: "소유자",
        appUserAlias: "owner-alias",
      });
      await seedUser({
        id: SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
        email: "other@example.com",
        name: null,
      });

      // When
      const users = await reader.listByAppUserIds([
        SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
        "owner-alias",
        SUBSCRIPTION_FIXTURE_USER_ID,
        "unknown-app-user",
      ]);

      // Then
      expect(users.map((user) => user.id.value)).toEqual([
        SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
        SUBSCRIPTION_FIXTURE_USER_ID,
      ]);
    });
  });
}
