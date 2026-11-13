import { describeInviteRedemptionRepositoryContract } from "#test/contracts/social/invite-redemption-repository.contract";
import { InMemoryInviteRedemptionReader } from "#test/doubles/social/in-memory-invite-redemption.reader";
import { InMemoryInviteRedemptionRepository } from "#test/doubles/social/in-memory-invite-redemption.repository";
import { InMemoryRewardGrantRepository } from "#test/doubles/social/in-memory-reward-grant.repository";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeInviteRedemptionRepositoryContract(async () => {
  const repository = new InMemoryInviteRedemptionRepository();
  return {
    repository,
    reader: new InMemoryInviteRedemptionReader(repository, new InMemoryRewardGrantRepository()),
  };
});
