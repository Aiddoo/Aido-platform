import { describeAppReleaseRepositoryContract } from "#test/contracts/app-config/app-release-repository.contract";
import { InMemoryAppReleaseRepository } from "#test/doubles/app-config/in-memory-app-release.repository";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeAppReleaseRepositoryContract(async () => new InMemoryAppReleaseRepository());
