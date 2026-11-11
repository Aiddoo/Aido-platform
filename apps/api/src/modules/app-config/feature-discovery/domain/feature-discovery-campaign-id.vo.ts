import { EntityId } from "#api/shared/domain/model/entity-id";

// 앱에 번들된 캠페인 문구의 key다. 예: feature-discovery-2026-12
export class FeatureDiscoveryCampaignId extends EntityId<string> {
  static reconstitute(value: string): FeatureDiscoveryCampaignId {
    return new FeatureDiscoveryCampaignId(value);
  }
}
