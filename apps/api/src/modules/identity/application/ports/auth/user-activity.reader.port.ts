export const USER_ACTIVITY_READER = Symbol("USER_ACTIVITY_READER");

export interface UserActivity {
  readonly userId: string;
  readonly lastActiveAt: Date | null;
  readonly signedUpAt: Date;
  /** UserPreference.timezone. 설정 행이 없으면 null이다. */
  readonly timezone: string | null;
}

export interface UserActivityReaderPort {
  /** 활동 기록을 읽는다. 정지·탈퇴 대기 계정은 결과에서 빠진다. */
  findActiveAccounts(userIds: readonly string[]): Promise<readonly UserActivity[]>;
}
