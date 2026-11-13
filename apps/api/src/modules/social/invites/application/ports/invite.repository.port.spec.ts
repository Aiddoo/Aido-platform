import { describeInviteRepositoryContract } from "#test/contracts/social/invite-repository.contract";
import { InMemoryInviteReader } from "#test/doubles/social/in-memory-invite.reader";
import { InMemoryInviteRepository } from "#test/doubles/social/in-memory-invite.repository";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeInviteRepositoryContract(async () => {
  const repository = new InMemoryInviteRepository();
  return { repository, reader: new InMemoryInviteReader(repository) };
});
