export const USER_APP_VERSION_READER = Symbol("USER_APP_VERSION_READER");

/** 인증 요청의 X-App-Version으로 남긴, 사용자가 마지막으로 쓴 앱 버전. 푸시 권한이 없어도 남는다. */
export interface UserAppVersionReaderPort {
  findLastSeenAppVersion(userId: string): Promise<string | null>;
}
