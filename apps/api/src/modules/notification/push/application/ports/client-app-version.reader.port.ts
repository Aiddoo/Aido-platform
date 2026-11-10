export const CLIENT_APP_VERSION_READER = Symbol("CLIENT_APP_VERSION_READER");

/**
 * 사용자가 쓰는 앱 버전 capability. 앱이 푸시 토큰을 등록할 때 남긴 버전으로 판단한다.
 * 예약 작업처럼 요청 헤더가 없는 곳에서 앱이 지원하는 동작을 고르는 데 쓴다.
 */
export interface ClientAppVersionReaderPort {
  /** 활성 기기 중 가장 높은 앱 버전. 버전을 남긴 기기가 없으면 null */
  findLatestAppVersion(userId: string): Promise<string | null>;
}
