import type { AppConfigFeatureDiscoveryConfig } from "../../app-config-feature-discovery.config.js";
import { FeatureDiscoveryCampaign } from "../../domain/feature-discovery-campaign.aggregate.js";

// 시작할 때 검증한 설정이라도 읽는 쪽에서 한 번 더 닫는다(검증을 우회하는 로더가 생겨도 켜지지 않는다)
export function toFeatureDiscoveryCampaign(
  config: AppConfigFeatureDiscoveryConfig,
): FeatureDiscoveryCampaign | null {
  const { enabled, campaignId, minAppVersion, launchedAt, autoOpen } = config;
  if (!enabled || !campaignId || !minAppVersion || !launchedAt) {
    return null;
  }

  const launchedAtInstant = parseInstant(launchedAt);
  if (launchedAtInstant == null) {
    return null;
  }
  return FeatureDiscoveryCampaign.reconstitute({
    campaignId,
    minAppVersion,
    launchedAt: launchedAtInstant,
    autoOpen,
  });
}

function parseInstant(raw: string): Temporal.Instant | null {
  try {
    return Temporal.Instant.from(raw);
  } catch {
    return null;
  }
}
