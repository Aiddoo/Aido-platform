import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export abstract class UserActivityWriterPort {
  /**
   * 마지막 활동 시각과 활동일을 남긴다. appVersion(SemVer)이 있으면 요청한 앱 버전도 함께 남겨,
   * 요청 헤더가 없는 예약 작업이 사용자의 앱이 지원하는 동작을 고를 수 있게 한다.
   */
  abstract updateLastActiveAt(activity: {
    readonly userId: UserId;
    readonly timezone: string;
    readonly seenAt: Temporal.Instant;
    readonly appVersion?: string;
  }): Promise<void>;
}
