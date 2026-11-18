export abstract class OAuthRuntimeConfigPort {
  /** 개발 빌드의 OAuth 복귀 주소(aido-dev://·localhost·exp://)를 받는다. 스테이징·운영은 false다 */
  abstract readonly allowsDevRedirects: boolean;
}
