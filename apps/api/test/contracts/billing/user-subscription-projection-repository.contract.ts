import type { SubscriptionStatus } from "@aido/api/vocabulary";

import type {
  UserSubscriptionProjection,
  UserSubscriptionProjectionRepositoryPort,
} from "#api/modules/billing/premium-grants/application/ports/user-subscription-projection.repository.port";
import { DatabaseRecordNotFoundError } from "#api/platform/database/database-error.util";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { SUBSCRIPTION_FIXTURE_NOW } from "#test/fixtures/billing/subscription.fixture";

const PROJECTION_CONTRACT_USER_IDS = [
  "clz7x5p8k0001qz0z8z8z8z8z",
  "clz7x5p8k0002qz0z8z8z8z8z",
  "clz7x5p8k0003qz0z8z8z8z8z",
] as const;

interface SeedProjectionUserInput {
  readonly id: string;
  readonly subscriptionStatus: SubscriptionStatus;
  readonly subscriptionExpiresAt: Temporal.Instant | null;
  readonly deleted?: boolean;
}

// User 행을 만들고 읽는 방법은 구현마다 달라서 계약은 하네스로 받는다
export interface UserSubscriptionProjectionHarness {
  readonly repository: UserSubscriptionProjectionRepositoryPort;
  seedUser(input: SeedProjectionUserInput): Promise<void>;
  readProjection(userId: string): Promise<UserSubscriptionProjection | null>;
}

const NOW = SUBSCRIPTION_FIXTURE_NOW;
const PAST = NOW.subtract({ hours: 24 });
const FUTURE = NOW.add({ hours: 24 });
const [FIRST_ID, SECOND_ID, THIRD_ID] = PROJECTION_CONTRACT_USER_IDS;

function idValues(userIds: readonly UserId[]): string[] {
  return userIds.map((userId) => userId.value);
}

export function describeUserSubscriptionProjectionRepositoryContract(
  createHarness: () => Promise<UserSubscriptionProjectionHarness>,
): void {
  describe("User 구독 projection 저장소 계약", () => {
    describe("update", () => {
      it("상태와 만료 시각을 User에 저장한다", async () => {
        // Given
        const { repository, seedUser, readProjection } = await createHarness();
        await seedUser({ id: FIRST_ID, subscriptionStatus: "FREE", subscriptionExpiresAt: null });

        // When
        await repository.update(UserId.reconstitute(FIRST_ID), {
          subscriptionStatus: "ACTIVE",
          subscriptionExpiresAt: FUTURE,
        });

        // Then
        const stored = await readProjection(FIRST_ID);
        expect(stored?.subscriptionStatus).toBe("ACTIVE");
        expect(stored?.subscriptionExpiresAt?.equals(FUTURE)).toBe(true);
      });

      it("만료 시각을 null로 주면 지운다", async () => {
        // Given
        const { repository, seedUser, readProjection } = await createHarness();
        await seedUser({
          id: FIRST_ID,
          subscriptionStatus: "ACTIVE",
          subscriptionExpiresAt: FUTURE,
        });

        // When
        await repository.update(UserId.reconstitute(FIRST_ID), {
          subscriptionStatus: "FREE",
          subscriptionExpiresAt: null,
        });

        // Then
        expect(await readProjection(FIRST_ID)).toEqual({
          subscriptionStatus: "FREE",
          subscriptionExpiresAt: null,
        });
      });

      it("만료 시각을 생략하면 저장된 값을 그대로 둔다", async () => {
        // Given
        const { repository, seedUser, readProjection } = await createHarness();
        await seedUser({
          id: FIRST_ID,
          subscriptionStatus: "ACTIVE",
          subscriptionExpiresAt: FUTURE,
        });

        // When
        await repository.update(UserId.reconstitute(FIRST_ID), {
          subscriptionStatus: "CANCELLED",
        });

        // Then
        const stored = await readProjection(FIRST_ID);
        expect(stored?.subscriptionStatus).toBe("CANCELLED");
        expect(stored?.subscriptionExpiresAt?.equals(FUTURE)).toBe(true);
      });

      it("다른 사용자의 projection은 바꾸지 않는다", async () => {
        // Given
        const { repository, seedUser, readProjection } = await createHarness();
        await seedUser({ id: FIRST_ID, subscriptionStatus: "FREE", subscriptionExpiresAt: null });
        await seedUser({ id: SECOND_ID, subscriptionStatus: "FREE", subscriptionExpiresAt: null });

        // When
        await repository.update(UserId.reconstitute(FIRST_ID), {
          subscriptionStatus: "ACTIVE",
          subscriptionExpiresAt: FUTURE,
        });

        // Then
        expect(await readProjection(SECOND_ID)).toEqual({
          subscriptionStatus: "FREE",
          subscriptionExpiresAt: null,
        });
      });

      it("User가 없으면 DatabaseRecordNotFoundError를 던진다", async () => {
        // Given
        const { repository } = await createHarness();

        // When
        const update = repository.update(UserId.reconstitute(FIRST_ID), {
          subscriptionStatus: "ACTIVE",
        });

        // Then
        await expect(update).rejects.toBeInstanceOf(DatabaseRecordNotFoundError);
      });
    });

    describe("listLapsedPremiumUserIds", () => {
      it("ACTIVE인데 만료 시각이 지난 사용자만 userId 순으로 준다", async () => {
        // Given
        const { repository, seedUser } = await createHarness();
        await seedUser({ id: THIRD_ID, subscriptionStatus: "ACTIVE", subscriptionExpiresAt: PAST });
        await seedUser({ id: FIRST_ID, subscriptionStatus: "ACTIVE", subscriptionExpiresAt: PAST });
        await seedUser({
          id: SECOND_ID,
          subscriptionStatus: "ACTIVE",
          subscriptionExpiresAt: FUTURE,
        });

        // When
        const lapsed = await repository.listLapsedPremiumUserIds({ now: NOW, limit: 10 });

        // Then
        expect(idValues(lapsed)).toEqual([FIRST_ID, THIRD_ID]);
      });

      it("만료 시각이 없는 ACTIVE는 웹훅이 바꿀 때까지 유지하므로 제외한다", async () => {
        // Given
        const { repository, seedUser } = await createHarness();
        await seedUser({ id: FIRST_ID, subscriptionStatus: "ACTIVE", subscriptionExpiresAt: null });

        // When
        const lapsed = await repository.listLapsedPremiumUserIds({ now: NOW, limit: 10 });

        // Then
        expect(lapsed).toEqual([]);
      });

      it("ACTIVE가 아닌 사용자는 만료 시각이 지났어도 제외한다", async () => {
        // Given
        const { repository, seedUser } = await createHarness();
        await seedUser({ id: FIRST_ID, subscriptionStatus: "FREE", subscriptionExpiresAt: PAST });
        await seedUser({
          id: SECOND_ID,
          subscriptionStatus: "EXPIRED",
          subscriptionExpiresAt: PAST,
        });

        // When
        const lapsed = await repository.listLapsedPremiumUserIds({ now: NOW, limit: 10 });

        // Then
        expect(lapsed).toEqual([]);
      });

      it("탈퇴한 사용자는 제외한다", async () => {
        // Given
        const { repository, seedUser } = await createHarness();
        await seedUser({
          id: FIRST_ID,
          subscriptionStatus: "ACTIVE",
          subscriptionExpiresAt: PAST,
          deleted: true,
        });

        // When
        const lapsed = await repository.listLapsedPremiumUserIds({ now: NOW, limit: 10 });

        // Then
        expect(lapsed).toEqual([]);
      });

      it("afterUserId 뒤부터 limit만큼만 준다", async () => {
        // Given
        const { repository, seedUser } = await createHarness();
        for (const id of PROJECTION_CONTRACT_USER_IDS) {
          await seedUser({ id, subscriptionStatus: "ACTIVE", subscriptionExpiresAt: PAST });
        }

        // When
        const page = await repository.listLapsedPremiumUserIds({
          now: NOW,
          afterUserId: UserId.reconstitute(FIRST_ID),
          limit: 1,
        });

        // Then
        expect(idValues(page)).toEqual([SECOND_ID]);
      });

      it("다시 계산해 projection이 바뀐 사용자는 조건에서 빠진다", async () => {
        // Given
        const { repository, seedUser } = await createHarness();
        await seedUser({ id: FIRST_ID, subscriptionStatus: "ACTIVE", subscriptionExpiresAt: PAST });
        await repository.update(UserId.reconstitute(FIRST_ID), {
          subscriptionStatus: "FREE",
          subscriptionExpiresAt: null,
        });

        // When
        const lapsed = await repository.listLapsedPremiumUserIds({ now: NOW, limit: 10 });

        // Then
        expect(lapsed).toEqual([]);
      });
    });
  });
}
