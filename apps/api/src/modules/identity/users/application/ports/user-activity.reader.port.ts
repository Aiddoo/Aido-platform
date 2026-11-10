export interface UserActivity {
  readonly userId: string;
  readonly lastActiveAt: Temporal.Instant | null;
  readonly signedUpAt: Temporal.Instant;
  /** UserPreference.timezone. 설정 행이 없으면 null이다. */
  readonly timezone: string | null;
}

export abstract class UserActivityReaderPort {
  /** 활동 기록을 읽는다. 정지·탈퇴 대기 계정은 결과에서 빠진다. */
  abstract findActiveAccounts(userIds: readonly string[]): Promise<readonly UserActivity[]>;
}
