import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

/** 인증 요청의 X-App-Version으로 남긴, 사용자가 마지막으로 쓴 앱 버전. 푸시 권한이 없어도 남는다. */
export abstract class UserAppVersionReaderPort {
  abstract findLastSeenAppVersion(userId: UserId): Promise<string | null>;
}
