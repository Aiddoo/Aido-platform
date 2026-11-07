/** 스토어가 설치 때 넘긴 referrer 문자열. 지원하지 않는 플랫폼은 null이다 */
export interface InstallReferrerGateway {
  read(): Promise<string | null>;
}
