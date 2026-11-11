import type { SubscriptionUserReaderPort } from "#api/modules/billing/subscriptions/application/ports/subscription-user.reader.port";
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
      const found = await reader.findByAppUserId(SUBSCRIPTION_FIXTURE_USER_ID);

      // Then
      expect(found).toEqual({
        id: SUBSCRIPTION_FIXTURE_USER_ID,
        email: "owner@example.com",
        profile: { name: "소유자" },
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
      const found = await reader.findByAppUserId("owner-alias");

      // Then
      expect(found?.id).toBe(SUBSCRIPTION_FIXTURE_USER_ID);
    });

    it("프로필이 없는 사용자도 찾고 profile은 null이다", async () => {
      // Given
      const { reader, seedUser } = await createHarness();
      await seedUser({ id: SUBSCRIPTION_FIXTURE_USER_ID, email: "owner@example.com", name: null });

      // When
      const found = await reader.findByAppUserId(SUBSCRIPTION_FIXTURE_USER_ID);

      // Then
      expect(found).toMatchObject({ id: SUBSCRIPTION_FIXTURE_USER_ID, profile: null });
    });

    it("모르는 앱 사용자 ID는 null이다", async () => {
      // Given
      const { reader, seedUser } = await createHarness();
      await seedUser({
        id: SUBSCRIPTION_FIXTURE_USER_ID,
        email: "owner@example.com",
        name: "소유자",
      });

      // When
      const found = await reader.findByAppUserId("unknown-app-user");

      // Then
      expect(found).toBeNull();
    });
  });
}
