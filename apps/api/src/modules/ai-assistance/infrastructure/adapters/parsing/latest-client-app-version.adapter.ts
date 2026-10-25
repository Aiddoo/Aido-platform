import { compareSemanticVersions } from "@aido/api";
import { Inject, Injectable } from "@nestjs/common";

import {
  USER_APP_VERSION_READER,
  type UserAppVersionReaderPort,
} from "#api/modules/identity/identity-user-access.public";
import {
  CLIENT_APP_VERSION_READER,
  type ClientAppVersionReaderPort,
} from "#api/modules/notification/notification-delivery.public";

import type { AiClientAppVersionReaderPort } from "../../../application/ports/parsing/client-app-version.reader.port.js";

/**
 * 사용자가 쓰는 가장 높은 앱 버전. 푸시 토큰에 남은 기기별 버전과, 푸시 권한이 없어도 남는
 * 인증 요청의 마지막 앱 버전 중 높은 쪽을 고른다. 둘 다 없으면 null이다.
 */
@Injectable()
export class LatestClientAppVersionAdapter implements AiClientAppVersionReaderPort {
  constructor(
    @Inject(CLIENT_APP_VERSION_READER)
    private readonly pushDeviceVersions: Pick<ClientAppVersionReaderPort, "findLatestAppVersion">,
    @Inject(USER_APP_VERSION_READER)
    private readonly requestVersions: Pick<UserAppVersionReaderPort, "findLastSeenAppVersion">,
  ) {}

  async findLatestAppVersion(userId: string): Promise<string | null> {
    const [pushDeviceVersion, requestVersion] = await Promise.all([
      this.pushDeviceVersions.findLatestAppVersion(userId),
      this.requestVersions.findLastSeenAppVersion(userId),
    ]);
    if (pushDeviceVersion == null || requestVersion == null) {
      return pushDeviceVersion ?? requestVersion;
    }
    return (compareSemanticVersions(requestVersion, pushDeviceVersion) ?? 0) > 0
      ? requestVersion
      : pushDeviceVersion;
  }
}
