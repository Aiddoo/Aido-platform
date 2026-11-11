import type { SubscriptionStatus, UserRole } from "@aido/api/vocabulary";

import type { AccessStateReaderPort } from "#api/modules/access/entitlements/application/ports/access-state.reader.port";
import type { FeatureGrantRepositoryPort } from "#api/modules/access/entitlements/application/ports/feature-grant.repository.port";
import type { FeatureGrantId } from "#api/modules/access/entitlements/domain/feature-grant-id.vo";
import { FeatureGrant } from "#api/modules/access/entitlements/domain/feature-grant.aggregate";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  ACCESS_FIXTURE_NOW,
  ACCESS_FIXTURE_OTHER_USER_ID,
  ACCESS_FIXTURE_USER_ID,
} from "#test/fixtures/access/access-user.fixture";

const USER_ID = UserId.reconstitute(ACCESS_FIXTURE_USER_ID);
const OTHER_USER_ID = UserId.reconstitute(ACCESS_FIXTURE_OTHER_USER_ID);

interface SeedAccessUserInput {
  readonly id: string;
  readonly role: UserRole;
  readonly subscriptionStatus: SubscriptionStatus;
  /** User 구독 projection의 만료 시각. 스토어 구독 행은 두지 않는다 */
  readonly subscriptionExpiresAt: Temporal.Instant | null;
  /** 활성이고 지우지 않은 계정인지 */
  readonly isActive: boolean;
}

export interface AccessStateReaderHarness {
  readonly reader: AccessStateReaderPort;
  readonly featureGrantRepository: FeatureGrantRepositoryPort;
  seedUser(input: SeedAccessUserInput): Promise<void>;
  /** 도메인 검증을 거치지 않은 친구 자리 행(손으로 넣은 0·음수 포함) */
  seedFriendGrantRow(input: { readonly userId: string; readonly quantity: number }): Promise<void>;
}

function friendGrant(params: {
  readonly id: FeatureGrantId;
  readonly userId: UserId;
  readonly quantity: number;
  readonly sourceKey: string;
}): FeatureGrant {
  return FeatureGrant.create({ ...params, feature: "FRIEND", now: ACCESS_FIXTURE_NOW });
}

export function describeAccessStateReaderContract(
  createHarness: () => Promise<AccessStateReaderHarness>,
): void {
  describe("권한 상태 reader·기능 자리 저장소 계약", () => {
    it("활성 사용자는 두 조회 모두 역할·구독 상태와 projection 만료 시각을 돌려준다", async () => {
      // Given
      const harness = await createHarness();
      const expiresAt = ACCESS_FIXTURE_NOW.add({ hours: 24 });
      await harness.seedUser({
        id: ACCESS_FIXTURE_USER_ID,
        role: "ADMIN",
        subscriptionStatus: "ACTIVE",
        subscriptionExpiresAt: expiresAt,
        isActive: true,
      });

      // When
      const states = [
        await harness.reader.findActiveUserAccessState(USER_ID),
        await harness.reader.findAccessState(USER_ID),
      ];

      // Then
      for (const state of states) {
        expect(state).toMatchObject({ role: "ADMIN", subscriptionStatus: "ACTIVE" });
        expect(state?.accessDeadline?.equals(expiresAt)).toBe(true);
      }
    });

    it("비활성 계정은 읽기 판단에서 빠지지만 원장 판단은 계속 읽고 없는 사용자는 둘 다 null이다", async () => {
      // Given
      const harness = await createHarness();
      await harness.seedUser({
        id: ACCESS_FIXTURE_USER_ID,
        role: "USER",
        subscriptionStatus: "FREE",
        subscriptionExpiresAt: null,
        isActive: false,
      });

      // When
      const active = await harness.reader.findActiveUserAccessState(USER_ID);
      const any = await harness.reader.findAccessState(USER_ID);
      const missing = await harness.reader.findAccessState(OTHER_USER_ID);

      // Then
      expect(active).toBeNull();
      expect(any).toEqual({ role: "USER", subscriptionStatus: "FREE", accessDeadline: null });
      expect(missing).toBeNull();
    });

    it("자리는 출처 키마다 한 번만 저장하고 사용자별 합계를 읽으며 받은 것이 없으면 키가 없다", async () => {
      // Given
      const harness = await createHarness();
      for (const id of [ACCESS_FIXTURE_USER_ID, ACCESS_FIXTURE_OTHER_USER_ID]) {
        await harness.seedUser({
          id,
          role: "USER",
          subscriptionStatus: "FREE",
          subscriptionExpiresAt: null,
          isActive: true,
        });
      }
      const { featureGrantRepository } = harness;

      // When
      const saved = [
        await featureGrantRepository.saveIfAbsent(
          friendGrant({
            id: await featureGrantRepository.nextId(),
            userId: USER_ID,
            quantity: 1,
            sourceKey: "invite:1",
          }),
        ),
        await featureGrantRepository.saveIfAbsent(
          friendGrant({
            id: await featureGrantRepository.nextId(),
            userId: USER_ID,
            quantity: 2,
            sourceKey: "invite:2",
          }),
        ),
        await featureGrantRepository.saveIfAbsent(
          friendGrant({
            id: await featureGrantRepository.nextId(),
            userId: USER_ID,
            quantity: 5,
            sourceKey: "invite:1",
          }),
        ),
      ];

      // Then
      expect(saved).toEqual([true, true, false]);
      expect(await harness.reader.findFeatureGrants(USER_ID)).toEqual({ FRIEND: 3 });
      expect(await harness.reader.findFeatureGrants(OTHER_USER_ID)).toEqual({});
    });

    it("손으로 넣은 0·음수 자리 행은 합계에서 빼서 한도를 줄이지 않는다", async () => {
      // Given
      const harness = await createHarness();
      for (const id of [ACCESS_FIXTURE_USER_ID, ACCESS_FIXTURE_OTHER_USER_ID]) {
        await harness.seedUser({
          id,
          role: "USER",
          subscriptionStatus: "FREE",
          subscriptionExpiresAt: null,
          isActive: true,
        });
      }
      await harness.seedFriendGrantRow({ userId: ACCESS_FIXTURE_USER_ID, quantity: 2 });
      await harness.seedFriendGrantRow({ userId: ACCESS_FIXTURE_USER_ID, quantity: -5 });
      await harness.seedFriendGrantRow({ userId: ACCESS_FIXTURE_USER_ID, quantity: 0 });
      await harness.seedFriendGrantRow({ userId: ACCESS_FIXTURE_OTHER_USER_ID, quantity: -1 });

      // When
      const grants = await harness.reader.findFeatureGrants(USER_ID);
      const onlyNegative = await harness.reader.findFeatureGrants(OTHER_USER_ID);

      // Then
      expect(grants).toEqual({ FRIEND: 2 });
      expect(onlyNegative).toEqual({});
    });
  });
}
