import type { FeatureDiscoveryResponse } from "@aido/api/contracts/app-config";

import { toIsoString } from "#api/shared/domain/time/instant";

import type { FeatureDiscoveryCampaign } from "../../../domain/feature-discovery-campaign.aggregate.js";

export function toFeatureDiscoveryResponse(
  campaign: FeatureDiscoveryCampaign | null,
): FeatureDiscoveryResponse {
  if (campaign == null) {
    return { enabled: false };
  }
  return {
    enabled: true,
    campaignId: campaign.id.value,
    minAppVersion: campaign.minAppVersion.value,
    launchedAt: toIsoString(campaign.launchedAt),
    autoOpen: campaign.autoOpen,
  };
}
