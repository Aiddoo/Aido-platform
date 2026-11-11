import type { InviteRedemptionRepositoryPort } from "#api/modules/social/invites/application/ports/invite-redemption.repository.port";
import type {
  InviteRedemption,
  InviteRedemptionPrimitives,
} from "#api/modules/social/invites/domain/invite-redemption.aggregate";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  activeDaysOf,
  createInviteRedemptionFixture,
} from "#test/fixtures/social/invite-redemption.fixture";
import {
  INVITE_FIXTURE_INVITEES,
  INVITE_FIXTURE_INVITER_ID,
  INVITE_FIXTURE_NOW,
  INVITE_FIXTURE_OTHER_INVITER_ID,
  inviteFixtureInviteeId,
} from "#test/fixtures/social/invite.fixture";

const INVITER_ID = UserId.reconstitute(INVITE_FIXTURE_INVITER_ID);
const NOW = INVITE_FIXTURE_NOW;

function minutesAfter(minutes: number): Temporal.Instant {
  return NOW.add({ minutes });
}

async function addRedemption(
  repository: InviteRedemptionRepositoryPort,
  overrides: Partial<InviteRedemptionPrimitives> = {},
): Promise<InviteRedemption> {
  const redemption = createInviteRedemptionFixture({
    id: (await repository.nextId()).value,
    ...overrides,
  });
  if (!(await repository.add(redemption))) {
    throw new Error("수락을 저장하지 못했습니다");
  }
  return redemption;
}

export function describeInviteRedemptionRepositoryContract(
  createRepository: () => Promise<InviteRedemptionRepositoryPort>,
): void {
  describe("초대 수락 저장소 계약", () => {
    it("nextId는 부를 때마다 다른 id를 준다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const ids = [await repository.nextId(), await repository.nextId()];

      // Then
      expect(ids[0]?.equals(ids[1] ?? ids[0])).toBe(false);
    });

    it("같은 초대받은 사람의 두 번째 수락은 저장하지 않고 false를 반환한다", async () => {
      // Given
      const repository = await createRepository();
      const first = await addRedemption(repository);
      const second = createInviteRedemptionFixture({
        id: (await repository.nextId()).value,
        inviterId: INVITE_FIXTURE_OTHER_INVITER_ID,
      });

      // When
      const added = await repository.add(second);

      // Then
      expect(added).toBe(false);
      const found = await repository.findByInviteeIdForUpdate(first.inviteeId);
      expect(found?.toPrimitives()).toEqual(first.toPrimitives());
    });

    it("활동일과 상태를 저장하면 같은 Aggregate로 다시 읽고 같은 날짜를 두 번 남기지 않는다", async () => {
      // Given
      const repository = await createRepository();
      const redemption = await addRedemption(repository);
      redemption.recordActivity(Temporal.Instant.from("2028-02-28T14:59:00Z"));
      await repository.save(redemption);
      redemption.recordActivity(Temporal.Instant.from("2028-02-28T15:01:00Z"));
      redemption.qualify(minutesAfter(1));

      // When
      await repository.save(redemption);
      const found = await repository.findByIdForUpdate(redemption.id);

      // Then
      expect(found?.toPrimitives()).toEqual(redemption.toPrimitives());
      expect(found?.activeDays.map((day) => day.toString())).toEqual(["2028-02-28", "2028-02-29"]);
    });

    it("사용 시작 전인 수락만 JOINED로 있다고 본다", async () => {
      // Given
      const repository = await createRepository();
      const joined = await addRedemption(repository, { inviteeId: inviteFixtureInviteeId(0) });
      const qualified = await addRedemption(repository, {
        inviteeId: inviteFixtureInviteeId(1),
        status: "QUALIFIED",
        qualifiedAt: NOW,
      });

      // When
      const exists = [
        await repository.existsJoinedByInviteeId(joined.inviteeId),
        await repository.existsJoinedByInviteeId(qualified.inviteeId),
        await repository.existsJoinedByInviteeId(UserId.reconstitute(inviteFixtureInviteeId(2))),
      ];

      // Then
      expect(exists).toEqual([true, false, false]);
    });

    it("상태별 수는 그 초대한 사람의 수락만 센다", async () => {
      // Given
      const repository = await createRepository();
      await addRedemption(repository, { inviteeId: inviteFixtureInviteeId(0) });
      await addRedemption(repository, {
        inviteeId: inviteFixtureInviteeId(1),
        status: "REWARDED",
        qualifiedAt: NOW,
        rewardedAt: NOW,
      });
      await addRedemption(repository, {
        inviteeId: inviteFixtureInviteeId(2),
        status: "REJECTED",
        rejectionReason: "EXPIRED",
        rejectedAt: NOW,
      });
      await addRedemption(repository, {
        inviteeId: inviteFixtureInviteeId(3),
        inviterId: INVITE_FIXTURE_OTHER_INVITER_ID,
      });

      // When
      const summary = await repository.summarizeByInviterId(INVITER_ID);

      // Then
      expect(summary).toEqual({
        joinedCount: 1,
        qualifiedCount: 0,
        rewardedCount: 1,
        rejectedCount: 1,
      });
    });

    it("초대한 친구는 수락 시각·id 내림차순으로 프로필·활동일 수와 함께 나열하고 마지막 친구 뒤부터 이어 준다", async () => {
      // Given
      const repository = await createRepository();
      const tiedOlder = await addRedemption(repository, {
        id: "c0000000000000000000rdm0a",
        inviteeId: inviteFixtureInviteeId(0),
        joinedAt: NOW,
      });
      const tiedNewer = await addRedemption(repository, {
        id: "c0000000000000000000rdm0b",
        inviteeId: inviteFixtureInviteeId(1),
        joinedAt: NOW,
      });
      const active = await addRedemption(repository, {
        inviteeId: inviteFixtureInviteeId(2),
        joinedAt: minutesAfter(2),
      });
      const newest = await addRedemption(repository, {
        inviteeId: inviteFixtureInviteeId(3),
        joinedAt: minutesAfter(3),
      });
      active.recordActivity(Temporal.Instant.from("2028-02-28T04:00:00Z"));
      await repository.save(active);

      // When
      const firstPage = await repository.listInvitedFriends({
        inviterId: INVITER_ID,
        afterInviteeId: null,
        status: null,
        limit: 3,
      });
      const nextPage = await repository.listInvitedFriends({
        inviterId: INVITER_ID,
        afterInviteeId: tiedNewer.inviteeId,
        status: null,
        limit: 3,
      });

      // Then
      expect(firstPage.map((friend) => friend.userId)).toEqual([
        newest.inviteeId.value,
        active.inviteeId.value,
        tiedNewer.inviteeId.value,
      ]);
      expect(nextPage.map((friend) => friend.userId)).toEqual([tiedOlder.inviteeId.value]);
      const invitee = INVITE_FIXTURE_INVITEES[2];
      expect(firstPage[1]).toEqual({
        userId: invitee?.id,
        name: invitee?.name,
        userTag: invitee?.userTag,
        profileImage: invitee?.profileImage,
        status: "JOINED",
        activeDayCount: 1,
        joinedAt: minutesAfter(2),
        qualifiedAt: null,
        rejectionReason: null,
      });
    });

    it("상태로 거르면 그 상태만 주고, 이어 읽을 친구가 없거나 다른 사람이 초대한 친구면 빈 목록이다", async () => {
      // Given
      const repository = await createRepository();
      const joined = await addRedemption(repository, { inviteeId: inviteFixtureInviteeId(0) });
      await addRedemption(repository, {
        inviteeId: inviteFixtureInviteeId(1),
        status: "QUALIFIED",
        qualifiedAt: NOW,
      });
      const foreign = await addRedemption(repository, {
        inviteeId: inviteFixtureInviteeId(2),
        inviterId: INVITE_FIXTURE_OTHER_INVITER_ID,
      });

      // When
      const waiting = await repository.listInvitedFriends({
        inviterId: INVITER_ID,
        afterInviteeId: null,
        status: "JOINED",
        limit: 10,
      });
      const afterUnknown = await repository.listInvitedFriends({
        inviterId: INVITER_ID,
        afterInviteeId: UserId.reconstitute(inviteFixtureInviteeId(3)),
        status: null,
        limit: 10,
      });
      const afterForeign = await repository.listInvitedFriends({
        inviterId: INVITER_ID,
        afterInviteeId: foreign.inviteeId,
        status: null,
        limit: 10,
      });

      // Then
      expect(waiting.map((friend) => friend.userId)).toEqual([joined.inviteeId.value]);
      expect([afterUnknown, afterForeign]).toEqual([[], []]);
    });

    it("마감 정비는 마감이 at 이하인 JOINED만 마감 순서로 limit만큼 거절한다", async () => {
      // Given
      const repository = await createRepository();
      const later = await addRedemption(repository, {
        inviteeId: inviteFixtureInviteeId(0),
        expiresAt: minutesAfter(2),
      });
      const earlier = await addRedemption(repository, {
        inviteeId: inviteFixtureInviteeId(1),
        expiresAt: minutesAfter(1),
      });
      const fresh = await addRedemption(repository, {
        inviteeId: inviteFixtureInviteeId(2),
        expiresAt: minutesAfter(10),
      });
      const qualified = await addRedemption(repository, {
        inviteeId: inviteFixtureInviteeId(3),
        status: "QUALIFIED",
        qualifiedAt: NOW,
        expiresAt: NOW,
      });
      const at = minutesAfter(2);

      // When
      const firstBatch = await repository.expireJoinedBefore(at, 1);
      const afterFirst = await repository.findByIdForUpdate(earlier.id);
      const secondBatch = await repository.expireJoinedBefore(at, 5);

      // Then
      expect([firstBatch, secondBatch]).toEqual([1, 1]);
      expect(afterFirst?.toPrimitives()).toMatchObject({
        status: "REJECTED",
        rejectionReason: "EXPIRED",
        rejectedAt: at,
      });
      const statuses = [];
      for (const redemption of [later, fresh, qualified]) {
        statuses.push((await repository.findByIdForUpdate(redemption.id))?.status);
      }
      expect(statuses).toEqual(["REJECTED", "JOINED", "QUALIFIED"]);
    });

    it("알림 후보는 아직 알리지 않은 보상 대상 JOINED 중 기간 안에 마감되는 수락을 마감·id 순서로 이어 준다", async () => {
      // Given
      const repository = await createRepository();
      const expiresBefore = minutesAfter(60);
      const first = await addRedemption(repository, {
        inviteeId: inviteFixtureInviteeId(0),
        expiresAt: minutesAfter(10),
        timezone: "America/Los_Angeles",
        activeDays: activeDaysOf("2028-02-27"),
      });
      const second = await addRedemption(repository, {
        inviteeId: inviteFixtureInviteeId(1),
        expiresAt: expiresBefore,
      });
      await addRedemption(repository, {
        inviteeId: inviteFixtureInviteeId(2),
        expiresAt: minutesAfter(20),
        qualifyReminderSentAt: NOW,
      });
      await addRedemption(repository, {
        inviteeId: inviteFixtureInviteeId(3),
        expiresAt: minutesAfter(20),
        inviterRewardEligible: false,
      });

      // When
      const firstPage = await repository.listQualifyReminderCandidates({
        now: NOW,
        expiresBefore,
        after: null,
        limit: 1,
      });
      const nextPage = await repository.listQualifyReminderCandidates({
        now: NOW,
        expiresBefore,
        after: firstPage[0] ?? null,
        limit: 5,
      });
      const afterExpiry = await repository.listQualifyReminderCandidates({
        now: minutesAfter(10),
        expiresBefore,
        after: null,
        limit: 5,
      });

      // Then
      expect(firstPage).toEqual([
        {
          redemptionId: first.id.value,
          timezone: "America/Los_Angeles",
          expiresAt: minutesAfter(10),
          activeDayCount: 1,
        },
      ]);
      expect(nextPage.map((candidate) => candidate.redemptionId)).toEqual([second.id.value]);
      expect(afterExpiry.map((candidate) => candidate.redemptionId)).toEqual([second.id.value]);
    });
  });
}
