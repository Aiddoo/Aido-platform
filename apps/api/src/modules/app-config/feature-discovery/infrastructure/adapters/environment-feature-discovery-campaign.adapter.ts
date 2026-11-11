import { Inject, Injectable } from "@nestjs/common";

import {
  type AppConfigFeatureDiscoveryConfig,
  appConfigFeatureDiscoveryConfig,
} from "../../app-config-feature-discovery.config.js";
import { FeatureDiscoveryCampaignReaderPort } from "../../application/ports/feature-discovery-campaign.reader.port.js";
import { FeatureDiscoveryCampaign } from "../../domain/feature-discovery-campaign.entity.js";

// 시작할 때 검증한 설정이라도 읽는 쪽에서 한 번 더 닫는다(검증을 우회하는 로더가 생겨도 켜지지 않는다)
@Injectable()
export class EnvironmentFeatureDiscoveryCampaignAdapter extends FeatureDiscoveryCampaignReaderPort {
  readonly #config: AppConfigFeatureDiscoveryConfig;

  constructor(
    @Inject(appConfigFeatureDiscoveryConfig.KEY) config: AppConfigFeatureDiscoveryConfig,
  ) {
    super();
    this.#config = config;
  }

  findActiveCampaign(): FeatureDiscoveryCampaign | null {
    const { enabled, campaignId, minAppVersion, launchedAt, autoOpen } = this.#config;
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
}

function parseInstant(raw: string): Temporal.Instant | null {
  try {
    return Temporal.Instant.from(raw);
  } catch {
    return null;
  }
}
