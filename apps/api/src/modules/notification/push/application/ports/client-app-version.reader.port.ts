// 예약 작업처럼 요청 헤더가 없는 곳에서 앱이 지원하는 동작을 고르려고 토큰 등록 때 남긴 앱 버전을 읽는다
export abstract class ClientAppVersionReaderPort {
  // 활성 기기 중 가장 높은 앱 버전이고, 버전을 남긴 기기가 없으면 null이다
  abstract findLatestAppVersion(userId: string): Promise<string | null>;
}
