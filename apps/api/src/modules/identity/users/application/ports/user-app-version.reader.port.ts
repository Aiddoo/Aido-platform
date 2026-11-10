/** 옛 토큰. 아직 옮기지 않은 소비 Context가 쓴다(같은 인스턴스 별칭으로 바인딩) */
export const USER_APP_VERSION_READER = Symbol("USER_APP_VERSION_READER");

/** 인증 요청의 X-App-Version으로 남긴, 사용자가 마지막으로 쓴 앱 버전. 푸시 권한이 없어도 남는다. */
export abstract class UserAppVersionReaderPort {
  abstract findLastSeenAppVersion(userId: string): Promise<string | null>;
}
