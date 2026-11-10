import type { SubscriptionStatus, UserRole } from "@aido/api/vocabulary";

import type { AccessStateReaderPort } from "#api/modules/access/entitlements/application/ports/access-state.reader.port";
import type { ResourceBonusRepositoryPort } from "#api/modules/access/entitlements/application/ports/resource-bonus.repository.port";
import type { ResourceBonusId } from "#api/modules/access/entitlements/domain/resource-bonus-id.vo";
import { ResourceBonus } from "#api/modules/access/entitlements/domain/resource-bonus.aggregate";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  ACCESS_FIXTURE_NOW,
  ACCESS_FIXTURE_OTHER_USER_ID,
  ACCESS_FIXTURE_USER_ID,
} from "#test/fixtures/access/access-user.fixture";

const USER_ID = UserId.reconstitute(ACCESS_FIXTURE_USER_ID);
const OTHER_USER_ID = UserId.reconstitute(ACCESS_FIXTURE_OTHER_USER_ID);

export interface SeedAccessUserInput {
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
  readonly resourceBonusRepository: ResourceBonusRepositoryPort;
  seedUser(input: SeedAccessUserInput): Promise<void>;
}

function bonus(params: {
  readonly id: ResourceBonusId;
  readonly userId: UserId;
  readonly quantity: number;
  readonly sourceKey: string;
}): ResourceBonus {
  return ResourceBonus.create({ ...params, resource: "FRIEND", now: ACCESS_FIXTURE_NOW });
}

export function describeAccessStateReaderContract(
  createHarness: () => Promise<AccessStateReaderHarness>,
): void {
  describe("권한 상태 reader·리소스 보너스 저장소 계약", () => {
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

    it("보너스는 출처 키마다 한 번만 저장하고 사용자별 합계를 읽는다", async () => {
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
      const { resourceBonusRepository } = harness;

      // When
      const saved = [
        await resourceBonusRepository.saveIfAbsent(
          bonus({
            id: await resourceBonusRepository.nextId(),
            userId: USER_ID,
            quantity: 1,
            sourceKey: "invite:1",
          }),
        ),
        await resourceBonusRepository.saveIfAbsent(
          bonus({
            id: await resourceBonusRepository.nextId(),
            userId: USER_ID,
            quantity: 2,
            sourceKey: "invite:2",
          }),
        ),
        await resourceBonusRepository.saveIfAbsent(
          bonus({
            id: await resourceBonusRepository.nextId(),
            userId: USER_ID,
            quantity: 5,
            sourceKey: "invite:1",
          }),
        ),
      ];

      // Then
      expect(saved).toEqual([true, true, false]);
      expect(await harness.reader.findResourceBonuses(USER_ID)).toEqual({ FRIEND: 3 });
      expect(await harness.reader.findResourceBonuses(OTHER_USER_ID)).toEqual({ FRIEND: 0 });
    });
  });
}
