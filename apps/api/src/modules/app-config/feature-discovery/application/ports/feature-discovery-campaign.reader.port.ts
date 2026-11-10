import type { FeatureDiscoveryCampaign } from "../../domain/feature-discovery-campaign.entity.js";

export abstract class FeatureDiscoveryCampaignReaderPort {
  // 꺼져 있거나 필수 설정이 빠진 경우 null이다(안전하게 닫는다)
  abstract findActiveCampaign(): FeatureDiscoveryCampaign | null;
}
