import type { BroadcastCampaignId } from "../../domain/broadcast-campaign-id.vo.js";
import type { BroadcastCampaign } from "../../domain/broadcast-campaign.aggregate.js";

export abstract class BroadcastCampaignRepositoryPort {
  abstract nextId(): Promise<BroadcastCampaignId>;
  // find 뒤 save로 쪼개면 같은 요청이 겹칠 때 둘 다 접수하므로 requestId 유일 제약으로 한 번에 접수한다
  /** 같은 요청 ID가 이미 있으면 새로 만들지 않고 기존 캠페인을 `created: false`로 돌려준다. */
  abstract acceptByRequestId(
    campaign: BroadcastCampaign,
  ): Promise<{ readonly campaign: BroadcastCampaign; readonly created: boolean }>;
  abstract findById(campaignId: BroadcastCampaignId): Promise<BroadcastCampaign | null>;
  /** 분배 페이지를 한 작업만 진행하도록 UoW 안에서 행을 잠근다. */
  abstract findByIdForUpdate(campaignId: BroadcastCampaignId): Promise<BroadcastCampaign | null>;
  abstract save(campaign: BroadcastCampaign): Promise<void>;
}
