import { sortBy } from "es-toolkit";

import type { InviteRedemptionReaderPort } from "#api/modules/social/invite-redemptions/application/ports/invite-redemption.reader.port";
import type { RewardGrantRepositoryPort } from "#api/modules/social/invite-redemptions/application/ports/reward-grant.repository.port";
import { InviteRedemptionId } from "#api/modules/social/invite-redemptions/domain/invite-redemption-id.vo";
import { RewardGrantId } from "#api/modules/social/invite-redemptions/domain/reward-grant-id.vo";
import type {
  RewardGrant,
  RewardGrantPrimitives,
} from "#api/modules/social/invite-redemptions/domain/reward-grant.entity";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  INVITE_FIXTURE_INVITEE_ID,
  INVITE_FIXTURE_INVITER_ID,
  INVITE_FIXTURE_NOW,
  INVITE_FIXTURE_OTHER_INVITER_ID,
} from "#test/fixtures/social/invite.fixture";
import { createRewardGrantFixture } from "#test/fixtures/social/reward-grant.fixture";

const INVITER_ID = UserId.reconstitute(INVITE_FIXTURE_INVITER_ID);
const NOW = INVITE_FIXTURE_NOW;
const REDEMPTION_A = "c0000000000000000000rdm0a";
const REDEMPTION_B = "c0000000000000000000rdm0b";
const REDEMPTION_C = "c0000000000000000000rdm0c";

function grantOf(overrides: Partial<RewardGrantPrimitives> = {}): RewardGrant {
  return createRewardGrantFixture({ id: RewardGrantId.generate().value, ...overrides });
}

async function addGrant(
  repository: RewardGrantRepositoryPort,
  overrides: Partial<RewardGrantPrimitives> = {},
): Promise<RewardGrant> {
  const grant = grantOf(overrides);
  await repository.addPending([grant]);
  return grant;
}

// 원장에 쓰고 초대한 사람 보상 합계는 수락 조회로 읽는다
export interface RewardGrantRepositoryContractSubject {
  readonly repository: RewardGrantRepositoryPort;
  readonly reader: Pick<InviteRedemptionReaderPort, "summarizeInviterRewards">;
}

export function describeRewardGrantRepositoryContract(
  createSubject: () => Promise<RewardGrantRepositoryContractSubject>,
): void {
  describe("보상 지급 원장 저장소 계약", () => {
    it("같은 (출처, 받는 사람, 종류)는 한 번만 저장하고 수락의 지급을 id 오름차순으로 읽는다", async () => {
      // Given
      const { repository } = await createSubject();
      const base = { sourceId: REDEMPTION_A };
      const grants = [
        grantOf({ ...base, recipientId: INVITE_FIXTURE_INVITEE_ID }),
        grantOf({ ...base, rewardType: "PREMIUM_DAYS" }),
        grantOf({ ...base, rewardType: "FRIEND_SLOT", quantity: 1 }),
        grantOf({ ...base, rewardType: "FRIEND_SLOT", quantity: 1 }),
        grantOf({ sourceId: REDEMPTION_B }),
      ];

      // When
      const insertedCount = await repository.addPending(grants);
      const listed = await repository.listByRedemptionId(
        InviteRedemptionId.reconstitute(REDEMPTION_A),
      );

      // Then
      expect(insertedCount).toBe(4);
      expect(listed.map((grant) => grant.toPrimitives())).toEqual(
        sortBy(
          grants.slice(0, 3).map((grant) => grant.toPrimitives()),
          ["id"],
        ),
      );
    });

    it("적용 표시는 PENDING·FAILED일 때 한 번만 바뀌고 실패 표시는 적용 전에만 시도 횟수를 센다", async () => {
      // Given
      const { repository } = await createSubject();
      const pending = await addGrant(repository, { sourceId: REDEMPTION_A });
      const failing = await addGrant(repository, { sourceId: REDEMPTION_B });

      // When
      const applied = [
        await repository.markApplied(pending.id, NOW),
        await repository.markApplied(pending.id, NOW),
      ];
      const attempts = [
        await repository.markFailed(failing.id, {
          errorCode: "USER_0601",
          failedAt: NOW,
          countsAttempt: true,
        }),
        await repository.markFailed(failing.id, {
          errorCode: "APPLY_FAILED",
          failedAt: NOW,
          countsAttempt: false,
        }),
        await repository.markFailed(pending.id, {
          errorCode: "APPLY_FAILED",
          failedAt: NOW,
          countsAttempt: true,
        }),
      ];
      const reapplied = await repository.markApplied(failing.id, NOW);

      // Then
      expect(applied).toEqual([true, false]);
      expect(attempts).toEqual([1, 1, null]);
      expect(reapplied).toBe(true);
      const statuses = [
        ...(await repository.listByRedemptionId(InviteRedemptionId.reconstitute(REDEMPTION_A))),
        ...(await repository.listByRedemptionId(InviteRedemptionId.reconstitute(REDEMPTION_B))),
      ].map((grant) => [grant.status, grant.attempts]);
      expect(statuses).toEqual([
        ["APPLIED", 0],
        ["APPLIED", 1],
      ]);
    });

    it("초대한 사람 보상은 종류별로 기간 안·전체·적용 합계를 내고 자동 재시도를 다 쓴 실패는 뺀다", async () => {
      // Given
      const { repository, reader } = await createSubject();
      const windowStart = NOW.subtract({ hours: 1 });
      await addGrant(repository, { sourceId: REDEMPTION_A, quantity: 7, status: "APPLIED" });
      await addGrant(repository, {
        sourceId: REDEMPTION_B,
        quantity: 3,
        createdAt: windowStart,
      });
      await addGrant(repository, {
        sourceId: REDEMPTION_C,
        quantity: 5,
        status: "FAILED",
        attempts: 5,
      });
      await addGrant(repository, {
        sourceId: REDEMPTION_A,
        rewardType: "FRIEND_SLOT",
        quantity: 1,
        createdAt: windowStart.add({ milliseconds: 1 }),
      });
      await addGrant(repository, {
        sourceId: REDEMPTION_A,
        recipientId: INVITE_FIXTURE_OTHER_INVITER_ID,
        quantity: 30,
      });

      // When
      const totals = await reader.summarizeInviterRewards(INVITER_ID, windowStart);
      const empty = await reader.summarizeInviterRewards(
        UserId.reconstitute(INVITE_FIXTURE_INVITEE_ID),
        windowStart,
      );

      // Then
      expect(sortBy(totals, ["rewardType"])).toEqual([
        { rewardType: "FRIEND_SLOT", quantityInWindow: 1, totalQuantity: 1, appliedQuantity: 0 },
        {
          rewardType: "PREMIUM_DAYS",
          quantityInWindow: 7,
          totalQuantity: 10,
          appliedQuantity: 7,
        },
      ]);
      expect(empty).toEqual([]);
    });

    it("재시도할 지급이 남은 수락만 id 순서로 한 번씩 이어 준다", async () => {
      // Given
      const { repository } = await createSubject();
      const createdBefore = NOW;
      await addGrant(repository, { sourceId: REDEMPTION_A });
      await addGrant(repository, {
        sourceId: REDEMPTION_A,
        rewardType: "FRIEND_SLOT",
        status: "FAILED",
        attempts: 1,
      });
      await addGrant(repository, { sourceId: REDEMPTION_B, status: "FAILED", attempts: 5 });
      await addGrant(repository, { sourceId: REDEMPTION_C, status: "APPLIED" });
      await addGrant(repository, {
        sourceId: "c0000000000000000000rdm0d",
        createdAt: createdBefore.add({ milliseconds: 1 }),
      });
      await addGrant(repository, { sourceId: "c0000000000000000000rdm0e", status: "FAILED" });
      const params = { maxAttempts: 5, createdBefore, limit: 1 };

      // When
      const first = await repository.listRetryableRedemptionIds({
        ...params,
        afterRedemptionId: null,
      });
      const second = await repository.listRetryableRedemptionIds({
        ...params,
        afterRedemptionId: first[0] ?? null,
      });
      const third = await repository.listRetryableRedemptionIds({
        ...params,
        afterRedemptionId: second[0] ?? null,
      });

      // Then
      expect([first, second, third].map((ids) => ids.map((id) => id.value))).toEqual([
        [REDEMPTION_A],
        ["c0000000000000000000rdm0e"],
        [],
      ]);
    });
  });
}
