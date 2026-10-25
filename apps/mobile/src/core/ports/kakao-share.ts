export interface KakaoFeedShare {
  title: string;
  description: string;
  imageUrl: string;
  /** 카카오톡이 없거나 웹에서 열 때 쓰는 링크 */
  webUrl: string;
  buttonTitle: string;
  /** 카카오톡 버튼이 앱을 열 때 kakao{키}://kakaolink?… 로 넘기는 값 */
  executionParams: Record<string, string>;
}

export interface KakaoShareGateway {
  /** 이 빌드에 카카오 앱 키가 있는지. 없으면 다른 공유로 대신한다 */
  isAvailable(): boolean;
  shareFeed(feed: KakaoFeedShare): Promise<void>;
}
