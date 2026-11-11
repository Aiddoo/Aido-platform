import { Entity } from "#api/shared/domain/model/entity";

import { AppVersion } from "../../shared/app-version.vo.js";
import { FeatureDiscoveryCampaignId } from "./feature-discovery-campaign-id.vo.js";

export interface FeatureDiscoveryCampaignPrimitives {
  readonly campaignId: string;
  readonly minAppVersion: string;
  readonly launchedAt: Temporal.Instant;
  readonly autoOpen: boolean;
}

interface FeatureDiscoveryCampaignProps {
  readonly minAppVersion: AppVersion;
  readonly launchedAt: Temporal.Instant;
  readonly autoOpen: boolean;
}

// 운영 kill switch로 켠 기능 소개 캠페인. 문구와 사용자 데이터는 앱이 갖고 서버는 메타데이터만 가진다
export class FeatureDiscoveryCampaign extends Entity<
  FeatureDiscoveryCampaignId,
  FeatureDiscoveryCampaignProps
> {
  static reconstitute(primitives: FeatureDiscoveryCampaignPrimitives): FeatureDiscoveryCampaign {
    return new FeatureDiscoveryCampaign(
      FeatureDiscoveryCampaignId.reconstitute(primitives.campaignId),
      {
        minAppVersion: AppVersion.reconstitute(primitives.minAppVersion),
        launchedAt: primitives.launchedAt,
        autoOpen: primitives.autoOpen,
      },
    );
  }

  get minAppVersion(): AppVersion {
    return this.props.minAppVersion;
  }

  get launchedAt(): Temporal.Instant {
    return this.props.launchedAt;
  }

  get autoOpen(): boolean {
    return this.props.autoOpen;
  }

  // 최소 버전보다 낮거나 SemVer가 아닌 앱에는 소개를 보이지 않는다
  isAvailableTo(clientVersion: string | null): boolean {
    if (clientVersion == null) {
      return false;
    }
    return AppVersion.reconstitute(clientVersion).isAtLeast(this.props.minAppVersion);
  }

  toPrimitives(): FeatureDiscoveryCampaignPrimitives {
    return {
      campaignId: this.id.value,
      minAppVersion: this.props.minAppVersion.value,
      launchedAt: this.props.launchedAt,
      autoOpen: this.props.autoOpen,
    };
  }
}
