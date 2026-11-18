import { describeFriendshipRepositoryContract } from "#test/contracts/social/friendship-repository.contract";
import { InMemoryFriendshipRepository } from "#test/doubles/social/in-memory-friendship.repository";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeFriendshipRepositoryContract(async () => new InMemoryFriendshipRepository());
