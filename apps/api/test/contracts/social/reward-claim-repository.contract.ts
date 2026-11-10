import type { RewardClaimRepositoryPort } from "#api/modules/social/invites/application/ports/reward-claim.repository.port";
import { INVITE_FIXTURE_NOW } from "#test/fixtures/social/invite.fixture";
import {
  createRewardClaimFixture,
  rewardClaimHashOf,
} from "#test/fixtures/social/reward-claim.fixture";

const INSTALLATION = createRewardClaimFixture({ claimHash: rewardClaimHashOf("a") });
const IDENTITY = createRewardClaimFixture({
  claimHash: rewardClaimHashOf("b"),
  claimKind: "IDENTITY",
});
const OTHER_IDENTITY = createRewardClaimFixture({
  claimHash: rewardClaimHashOf("c"),
  claimKind: "IDENTITY",
});

export function describeRewardClaimRepositoryContract(
  createRepository: () => Promise<RewardClaimRepositoryPort>,
): void {
  describe("보상 이력 저장소 계약", () => {
    it("신원이 하나도 없으면 claim하지 않고 이력도 없다고 본다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const results = [
        await repository.claimAll([], INVITE_FIXTURE_NOW),
        await repository.existsAny([]),
      ];

      // Then
      expect(results).toEqual([false, false]);
    });

    it("모두 새 신원이면 claim하고 그 뒤 같은 기기·신원은 이미 받은 것으로 본다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const claimed = await repository.claimAll([INSTALLATION, IDENTITY], INVITE_FIXTURE_NOW);
      const reclaimed = await repository.claimAll([IDENTITY], INVITE_FIXTURE_NOW);

      // Then
      expect([claimed, reclaimed]).toEqual([true, false]);
      expect(await repository.existsAny([OTHER_IDENTITY, IDENTITY])).toBe(true);
      expect(await repository.existsAny([OTHER_IDENTITY])).toBe(false);
    });

    it("하나라도 이미 있으면 이번 신원도 남기지 않는다", async () => {
      // Given
      const repository = await createRepository();
      await repository.claimAll([INSTALLATION], INVITE_FIXTURE_NOW);

      // When
      const claimed = await repository.claimAll([INSTALLATION, OTHER_IDENTITY], INVITE_FIXTURE_NOW);

      // Then
      expect(claimed).toBe(false);
      expect(await repository.existsAny([OTHER_IDENTITY])).toBe(false);
    });
  });
}
