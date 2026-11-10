import { compareSemanticVersions } from "@aido/api/vocabulary";
import { Injectable } from "@nestjs/common";

import { UserAppVersionReaderPort } from "#api/modules/identity/identity-user-access.public";
import { ClientAppVersionReaderPort } from "#api/modules/notification/notification-delivery.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { AiClientAppVersionReaderPort } from "../../application/ports/client-app-version.reader.port.js";

/**
 * 사용자가 쓰는 가장 높은 앱 버전. 푸시 토큰에 남은 기기별 버전과, 푸시 권한이 없어도 남는
 * 인증 요청의 마지막 앱 버전 중 높은 쪽을 고른다. 둘 다 없으면 null이다.
 */
@Injectable()
export class LatestClientAppVersionAdapter extends AiClientAppVersionReaderPort {
  readonly #pushDeviceVersions: Pick<ClientAppVersionReaderPort, "findLatestAppVersion">;
  readonly #requestVersions: Pick<UserAppVersionReaderPort, "findLastSeenAppVersion">;

  constructor(
    pushDeviceVersions: ClientAppVersionReaderPort,
    requestVersions: UserAppVersionReaderPort,
  ) {
    super();
    this.#pushDeviceVersions = pushDeviceVersions;
    this.#requestVersions = requestVersions;
  }

  async findLatestAppVersion(userId: UserId): Promise<string | null> {
    const [pushDeviceVersion, requestVersion] = await Promise.all([
      this.#pushDeviceVersions.findLatestAppVersion(userId.value),
      this.#requestVersions.findLastSeenAppVersion(userId.value),
    ]);
    if (pushDeviceVersion == null || requestVersion == null) {
      return pushDeviceVersion ?? requestVersion;
    }
    return (compareSemanticVersions(requestVersion, pushDeviceVersion) ?? 0) > 0
      ? requestVersion
      : pushDeviceVersion;
  }
}
