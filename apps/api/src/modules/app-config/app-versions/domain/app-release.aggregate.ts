import type { AppPlatform } from "@aido/api/vocabulary";

import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { AppVersion } from "../../shared/domain/app-version.vo.js";
import { AppReleaseId } from "./app-release-id.vo.js";

export interface AppReleasePrimitives {
  readonly platform: AppPlatform;
  readonly latestVersion: string;
  readonly updatedAt: Temporal.Instant;
}

interface AppReleaseProps {
  readonly latestVersion: AppVersion;
  readonly updatedAt: Temporal.Instant;
}

interface CreateAppReleaseParams {
  readonly platform: AppPlatform;
  readonly latestVersion: AppVersion;
  readonly now: Temporal.Instant;
}

// 스토어에 공개된 플랫폼별 최신 앱 릴리스. 운영자가 스토어 공개 뒤 관리자 API로 반영한다
export class AppRelease extends AggregateRoot<AppReleaseId, AppReleaseProps> {
  static create(params: CreateAppReleaseParams): AppRelease {
    return new AppRelease(AppReleaseId.reconstitute(params.platform), {
      latestVersion: params.latestVersion,
      updatedAt: params.now,
    });
  }

  static reconstitute(primitives: AppReleasePrimitives): AppRelease {
    return new AppRelease(AppReleaseId.reconstitute(primitives.platform), {
      latestVersion: AppVersion.reconstitute(primitives.latestVersion),
      updatedAt: primitives.updatedAt,
    });
  }

  get platform(): AppPlatform {
    return this.id.value;
  }

  get latestVersion(): AppVersion {
    return this.props.latestVersion;
  }

  toPrimitives(): AppReleasePrimitives {
    return {
      platform: this.platform,
      latestVersion: this.props.latestVersion.value,
      updatedAt: this.props.updatedAt,
    };
  }
}
