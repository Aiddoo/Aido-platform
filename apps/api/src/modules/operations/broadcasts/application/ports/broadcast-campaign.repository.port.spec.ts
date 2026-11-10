import { describeBroadcastCampaignRepositoryContract } from "#test/contracts/operations/broadcast-campaign-repository.contract";
import { InMemoryBroadcastCampaignRepository } from "#test/doubles/operations/in-memory-broadcast-campaign.repository";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeBroadcastCampaignRepositoryContract(async () => new InMemoryBroadcastCampaignRepository());
