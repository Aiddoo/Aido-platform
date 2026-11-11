import type { AppPlatform } from "@aido/api/vocabulary";

import { Entity } from "#api/shared/domain/model/entity";

import { AppVersion } from "../../shared/app-version.vo.js";
import { AppReleaseId } from "./app-release-id.vo.js";

export interface AppReleasePrimitives {
  readonly platform: AppPlatform;
  readonly latestVersion: string;
}

interface AppReleaseProps {
  readonly latestVersion: AppVersion;
}

// 스토어에 공개된 플랫폼별 최신 앱 릴리스
export class AppRelease extends Entity<AppReleaseId, AppReleaseProps> {
  static reconstitute(primitives: AppReleasePrimitives): AppRelease {
    return new AppRelease(AppReleaseId.reconstitute(primitives.platform), {
      latestVersion: AppVersion.reconstitute(primitives.latestVersion),
    });
  }

  get platform(): AppPlatform {
    return this.id.value;
  }

  get latestVersion(): AppVersion {
    return this.props.latestVersion;
  }

  // 알 수 없거나 SemVer가 아닌 앱 버전은 업데이트를 강요하지 않는다
  isUpdateRequired(clientVersion: string | null): boolean {
    if (clientVersion == null) {
      return false;
    }
    return AppVersion.reconstitute(clientVersion).isOlderThan(this.props.latestVersion);
  }

  toPrimitives(): AppReleasePrimitives {
    return { platform: this.platform, latestVersion: this.props.latestVersion.value };
  }
}
