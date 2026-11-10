import type {
  BroadcastCampaign,
  BroadcastCampaignCreationPlan,
} from "../../domain/broadcast-campaign.aggregate.js";

export const BROADCAST_CAMPAIGN_REPOSITORY = Symbol("BROADCAST_CAMPAIGN_REPOSITORY");

export interface BroadcastCampaignRepositoryPort {
  /** 같은 요청 ID가 이미 있으면 새로 만들지 않고 기존 캠페인을 `created: false`로 돌려준다. */
  createOrFind(
    plan: BroadcastCampaignCreationPlan,
  ): Promise<{ readonly campaign: BroadcastCampaign; readonly created: boolean }>;
  findById(campaignId: string): Promise<BroadcastCampaign | null>;
  /** 분배 페이지를 한 작업만 진행하도록 UNIT_OF_WORK 안에서 행을 잠근다. */
  findByIdForUpdate(campaignId: string): Promise<BroadcastCampaign | null>;
  save(campaign: BroadcastCampaign): Promise<void>;
}
